/**
 * 3 層を合成した OGP 取得のエントリポイント。
 *
 * 流れ:
 *   1. cache.get(url) → hit ならそのまま返す
 *   2. validateExternalUrl + resolveAndCheckDns で URL を SSRF 検査
 *   3. client.get(url) で HTML を取得 (リダイレクト等は client 内で吸収)
 *   4. extractOgp(html, finalUrl) で OGP を抽出 (open-graph-scraper ラッパ)
 *   5. sanitize(raw) で安全な `SafeOgp` に変換
 *   6. imageDownloader が指定されていれば imageUrl をローカル保存
 *   7. OgpRecord を組み立てて cache.set し、返却する
 *   どこかで失敗すれば `OgpFailure` を返し、同じく cache.set で「失敗」も
 *   キャッシュする (短時間に同一 URL を繰り返し fetch しない)
 *
 * 設計選択:
 *   - 依存はすべて `FetchOgpDeps` で注入する。テストは fake で全層を差し替える。
 *   - 失敗ケースは throw せず `OgpFailure` を返り値にする。呼出元 (remark
 *     プラグイン) は「失敗 = 素のリンクにフォールバック」「成功 = カード描画」
 *     を switch で分岐できる。
 *   - cache に失敗を保存する時、失敗 record を `null` にして TTL を成功と
 *     同じにする (今 phase では細分化しない、Phase 後半で必要なら短縮余地を残す)。
 */
import { OGP_CACHE_TTL_MS } from '../../constants/ogp'
import {
  resolveAndCheckDns,
  validateExternalUrl,
} from './validateUrl'
import type { HttpClient, HttpGetOptions } from './httpClient'
import type {
  OgpCache,
  OgpCacheEntry,
  OgpRecord,
} from './ogpCache'
import { sanitizeOgp } from './sanitizeOgp'
import type { RawOgp, SafeOgp } from './sanitizeOgp'

/**
 * 取得失敗時の戻り。`reason` は上位で「private IP 拒否」「fetch エラー」等を
 * ログ / 表示分岐するために短い文字列で返す。
 */
export interface OgpFailure {
  readonly ok: false
  readonly url: string
  readonly reason: string
}

/**
 * OGP 抽出関数の型。HTML 文字列と base URL を受け取って `RawOgp` を返す。
 *
 * `open-graph-scraper` のような実装は async (Promise<RawOgp>) を返すため
 * union 型で受け付ける。`fetchOgp` 内部で `await` してから sanitize に渡す
 * ため、sync / async どちらでも動作する。例外は throw。`fetchOgp` 内で
 * catch して failure に丸める。
 */
export type ExtractOgpFn = (
  html: string,
  baseUrl: string,
) => RawOgp | Promise<RawOgp>

/**
 * 画像 DL → 自サーバ配信パス返却のオプション関数。未指定なら `imagePath: null`。
 */
export type ImageDownloaderFn = (imageUrl: string) => Promise<string | null>

export interface FetchOgpDeps {
  /** Layer 2: HTTP クライアント。 */
  readonly client: HttpClient
  /** Layer 3: ディスクキャッシュ。 */
  readonly cache: OgpCache
  /** Layer 4: サニタイザ。テストで挙動を差し替えたい場合に DI 可能。 */
  readonly sanitize?: (raw: RawOgp) => SafeOgp
  /** 現在時刻 (ms)。`fetchedAt` / `expiresAt` を組むのに使う。 */
  readonly now: () => number
  /** OGP 抽出器。実装は open-graph-scraper をラップする想定。 */
  readonly extractOgp: ExtractOgpFn
  /** 画像 DL 関数。未指定なら imagePath は常に null。 */
  readonly imageDownloader?: ImageDownloaderFn
  /**
   * `client.get` に渡す共通オプション。タイムアウトやサイズ上限を呼び出し側で
   * 明示制御する。
   */
  readonly httpOptions: HttpGetOptions
  /**
   * DNS lookup 関数。`resolveAndCheckDns` に渡す。テストで差替え可能、本番では
   * 省略 (= 内部 default lookup) が標準。
   */
  readonly resolveDns?: (host: string) => Promise<readonly string[]>
}

/**
 * 文字列を Uint8Array (HTTP body) からデコードする。`text/html; charset=utf-8`
 * を主想定とし、簡略化のため UTF-8 固定。今後 Shift_JIS 等への対応が必要なら
 * Content-Type 解析を入れる余地。
 */
function decodeBodyAsUtf8(body: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false })
  return decoder.decode(body)
}

/**
 * cache.set に失敗 (record === null) または成功 (record !== null) を書き込む
 * ヘルパー。fetchedAt / expiresAt は now() を起点に 30 日 TTL を組む。
 */
async function persistEntry(
  cache: OgpCache,
  url: string,
  record: OgpRecord | null,
  now: () => number,
): Promise<void> {
  const fetchedAt = now()
  const entry: OgpCacheEntry = {
    record,
    fetchedAt,
    expiresAt: fetchedAt + OGP_CACHE_TTL_MS,
  }
  await cache.set(url, entry)
}

/**
 * `OgpFailure` を組み立てて返す + cache に失敗を書き込む補助。
 */
async function buildFailure(
  cache: OgpCache,
  url: string,
  reason: string,
  now: () => number,
): Promise<OgpFailure> {
  await persistEntry(cache, url, null, now)
  return { ok: false, url, reason }
}

/**
 * 3 層合成された OGP 取得関数。
 * @returns OGP メタデータ (`OgpRecord`) または失敗情報 (`OgpFailure`)
 */
export async function fetchOgp(
  url: string,
  deps: FetchOgpDeps,
): Promise<OgpRecord | OgpFailure> {
  const sanitize = deps.sanitize ?? sanitizeOgp

  // 1) キャッシュヒット判定。
  const cached = await deps.cache.get(url)
  if (cached !== null) {
    if (cached.record !== null) {
      return cached.record
    }
    // 失敗キャッシュも有効期限内ならそのまま failure 返却 (re-fetch しない)。
    return { ok: false, url, reason: 'cached_failure' }
  }

  // 2) URL 文字列段階の検査。
  const stringResult = validateExternalUrl(url)
  if (!stringResult.ok) {
    return buildFailure(deps.cache, url, `url_invalid:${stringResult.reason}`, deps.now)
  }

  // 3) DNS 段階の検査。
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return buildFailure(deps.cache, url, 'url_invalid:host', deps.now)
  }
  const dnsResult = await resolveAndCheckDns(parsed.hostname, deps.resolveDns)
  if (!dnsResult.ok) {
    return buildFailure(deps.cache, url, `dns_invalid:${dnsResult.reason}`, deps.now)
  }

  // 4) HTTP 取得。
  let response: Awaited<ReturnType<HttpClient['get']>>
  try {
    response = await deps.client.get(url, deps.httpOptions)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return buildFailure(deps.cache, url, `fetch_failed:${message}`, deps.now)
  }

  // 5) HTML 解釈 + OGP 抽出。extractOgp は sync / async どちらも許容するため
  // `await` で両対応する。
  const html = decodeBodyAsUtf8(response.body)
  let raw: RawOgp
  try {
    raw = await deps.extractOgp(html, response.finalUrl)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return buildFailure(deps.cache, url, `extract_failed:${message}`, deps.now)
  }

  // 6) サニタイズ。url が空文字に倒れたら failure。
  const safe = sanitize(raw)
  if (safe.url.length === 0) {
    return buildFailure(deps.cache, url, 'sanitize_url_empty', deps.now)
  }

  // 7) 画像保存 (imageDownloader 未指定なら null)。
  let imagePath: string | null = null
  if (deps.imageDownloader !== undefined && safe.imageUrl !== null) {
    try {
      imagePath = await deps.imageDownloader(safe.imageUrl)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // 画像 DL の失敗は致命的でないので imagePath: null のまま継続する。
      void message
      imagePath = null
    }
  }

  // 8) record 組立 + キャッシュ。
  const record: OgpRecord = {
    url: safe.url,
    title: safe.title,
    description: safe.description,
    imagePath,
    siteName: safe.siteName,
    fetchedAt: new Date(deps.now()).toISOString(),
  }
  await persistEntry(deps.cache, url, record, deps.now)
  return record
}
