/**
 * OGP 取得結果のディスクキャッシュ。
 *
 * Phase 3 では generate 時に外部サイトの OGP を fetch するが、毎回 HTTP
 * リクエストを飛ばすと build が遅く、外部サイトにも負荷をかける。30 日
 * TTL のファイルキャッシュ (`.cache/ogp/<sha1(url)>.json`) を挟むことで
 * 通常の generate ではキャッシュヒットさせ、ヒットしないものだけ実 fetch
 * する設計。
 *
 * 設計方針:
 *   - キャッシュキーは正規化済み URL の SHA-1。短く一意で、ファイル名として
 *     扱える形にする。
 *   - 取得失敗 (record === null) もキャッシュする。短時間に同一 URL の
 *     失敗を繰り返さないため。TTL は同じ 30 日とする (失敗側を短くしたい
 *     場合は将来分岐する余地)。
 *   - I/O は `node:fs/promises` を DI 可能にし、テストでは fake fs で動かす。
 *   - `now` も DI 可能にし、TTL の境界を決定的に検証できる。
 */
import { createHash } from 'node:crypto'
import { OGP_CACHE_DIR } from '../../constants/ogp'

/**
 * 1 件あたりの OGP メタデータ。`fetchOgp` の戻りや MDC コンポーネントへの
 * 入力として使う。
 */
export interface OgpRecord {
  /** 取得元 URL (リダイレクト後の最終 URL を入れる)。 */
  readonly url: string
  /** og:title をサニタイズ + 切り詰めた文字列。 */
  readonly title: string
  /** og:description をサニタイズ + 切り詰めた文字列。 */
  readonly description: string
  /**
   * 自サーバ配信パス (例: `/ogp-images/abc.png`)。画像保存処理が未実装
   * または保存失敗時は null。
   */
  readonly imagePath: string | null
  /** og:site_name (任意)。 */
  readonly siteName: string | null
  /** 取得時刻 (ISO8601)。ログ / デバッグ用。 */
  readonly fetchedAt: string
}

/**
 * キャッシュエントリ。`record` が null の場合は「取得失敗をキャッシュした」
 * 状態を表す。`fetchedAt` / `expiresAt` は ms (epoch) で扱う。
 */
export interface OgpCacheEntry {
  readonly record: OgpRecord | null
  readonly fetchedAt: number
  readonly expiresAt: number
}

/**
 * キャッシュ層の最小 interface。差替え可能にしておくことで、テストや将来の
 * Redis キャッシュ等への移行余地を残す。
 */
export interface OgpCache {
  get(url: string): Promise<OgpCacheEntry | null>
  set(url: string, entry: OgpCacheEntry): Promise<void>
}

/** `node:fs/promises` から本キャッシュが必要とする最小サブセット。 */
export interface OgpCacheFs {
  readFile(path: string, encoding: 'utf8'): Promise<string>
  writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>
  mkdir(path: string, opts: { recursive: true }): Promise<string | undefined>
}

export interface FileSystemCacheDeps {
  /** キャッシュファイル保存ディレクトリ。省略時は `OGP_CACHE_DIR`。 */
  readonly cacheDir?: string
  /** 現在時刻 (ms) を返す関数。テストで TTL 境界を制御するため DI。 */
  readonly now?: () => number
  /** node:fs/promises の差替え可能サブセット。 */
  readonly fs?: OgpCacheFs
}

/**
 * URL → ファイルパス変換。`<cacheDir>/<sha1(url)>.json` の形に整える。
 */
function buildCacheFilePath(cacheDir: string, url: string): string {
  const hash = createHash('sha1').update(url).digest('hex')
  // OS 非依存のため `/` 結合で十分 (Node の fs は両方扱える)。
  return `${cacheDir}/${hash}.json`
}

/**
 * `node:fs/promises` の readFile/writeFile/mkdir を本キャッシュ用 interface に
 * 合わせて返す。Node の標準型定義の signature と合わない `mkdir` の戻り型を
 * `string | undefined` に揃える。
 */
async function loadDefaultFs(): Promise<OgpCacheFs> {
  const fs = await import('node:fs/promises')
  return {
    readFile: (path, encoding) => fs.readFile(path, encoding),
    writeFile: (path, data, encoding) => fs.writeFile(path, data, encoding),
    mkdir: async (path, opts) => fs.mkdir(path, opts),
  }
}

/**
 * 文字列が空でない型ガード。`JSON.parse` 後の値判定に使う。
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * `parseOgpRecord` などの最小バリデーション。null 許容なフィールドは
 * undefined / null 両方を許容する。
 */
function parseOgpRecord(raw: unknown): OgpRecord | null {
  if (raw === null) {
    return null
  }
  if (typeof raw !== 'object') {
    return null
  }
  const obj = raw as Record<string, unknown>
  if (!isNonEmptyString(obj.url) || !isNonEmptyString(obj.fetchedAt)) {
    return null
  }
  if (typeof obj.title !== 'string' || typeof obj.description !== 'string') {
    return null
  }
  const imagePath
    = obj.imagePath === null || typeof obj.imagePath === 'string' ? obj.imagePath : null
  const siteName
    = obj.siteName === null || typeof obj.siteName === 'string' ? obj.siteName : null
  return {
    url: obj.url,
    title: obj.title,
    description: obj.description,
    imagePath,
    siteName,
    fetchedAt: obj.fetchedAt,
  }
}

/**
 * `OgpCacheEntry` を JSON から復元する。形式不正なら null。
 */
function parseCacheEntry(json: string): OgpCacheEntry | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  }
  catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') {
    return null
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.fetchedAt !== 'number' || typeof obj.expiresAt !== 'number') {
    return null
  }
  return {
    record: parseOgpRecord(obj.record),
    fetchedAt: obj.fetchedAt,
    expiresAt: obj.expiresAt,
  }
}

/**
 * ファイル I/O に基づく `OgpCache` を作成する。
 */
export function createFileSystemOgpCache(deps: FileSystemCacheDeps = {}): OgpCache {
  const cacheDir = deps.cacheDir ?? OGP_CACHE_DIR
  const now = deps.now ?? Date.now
  const fsPromise = deps.fs ?? null

  // fs が指定されない場合は遅延 import。ESM の dynamic import を毎回繰り返すと
  // パフォーマンスが落ちるため、最初の呼び出し時にだけ import して memoize する。
  let cachedFs: OgpCacheFs | null = fsPromise
  async function getFs(): Promise<OgpCacheFs> {
    if (cachedFs !== null) {
      return cachedFs
    }
    cachedFs = await loadDefaultFs()
    return cachedFs
  }

  return {
    async get(url: string): Promise<OgpCacheEntry | null> {
      const fs = await getFs()
      const path = buildCacheFilePath(cacheDir, url)
      let raw: string
      try {
        raw = await fs.readFile(path, 'utf8')
      }
      catch {
        // ENOENT を含むファイル read 失敗は cache miss として扱う。
        return null
      }
      const entry = parseCacheEntry(raw)
      if (entry === null) {
        return null
      }
      if (entry.expiresAt <= now()) {
        return null
      }
      return entry
    },

    async set(url: string, entry: OgpCacheEntry): Promise<void> {
      const fs = await getFs()
      await fs.mkdir(cacheDir, { recursive: true })
      const path = buildCacheFilePath(cacheDir, url)
      const serialized = JSON.stringify(entry)
      await fs.writeFile(path, serialized, 'utf8')
    },
  }
}
