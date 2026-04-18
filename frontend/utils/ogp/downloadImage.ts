/**
 * og:image を取得して自サーバ配信パス (`/ogp-images/<sha1>.<ext>`) に保存する
 * ローカルダウンローダ。
 *
 * 役割:
 *   - Layer 2 (`HttpClient`) で画像 URL を GET し、Content-Type を検査
 *   - 許可 MIME (`OGP_IMAGE_ALLOWED_MIMES`, SVG は含まれない) 以外は拒否
 *   - SHA-1 ハッシュと MIME→拡張子マップでファイル名を決定し、
 *     `public/ogp-images/<sha1>.<ext>` に保存
 *   - 保存に成功したら自サーバパス (`/ogp-images/<sha1>.<ext>`) を返す
 *
 * セキュリティ:
 *   - URL は `validateExternalUrl` + `resolveAndCheckDns` で SSRF 検査を通す
 *   - サイズ超過 / タイムアウト / 非許可 MIME はすべて null 戻りにする
 *   - 画像 DL は致命的でないため、失敗しても throw はしない (上位 `fetchOgp`
 *     は `imagePath: null` のまま record を継続)
 *
 * 設計選択:
 *   - 依存は `DownloadImageDeps` で注入する。`fs` / `outputDir` / `urlPrefix`
 *     を DI 可能にしてテスト容易性を担保する。
 *   - MIME→拡張子マップは `OGP_IMAGE_ALLOWED_MIMES` と対応付け、本ファイル
 *     冒頭で定義する。拡張子に依存する脆弱性 (MIME confusion 等) を抑止。
 */
import { createHash } from 'node:crypto'
import {
  OGP_FETCH_MAX_BYTES,
  OGP_FETCH_MAX_REDIRECTS,
  OGP_FETCH_TIMEOUT_MS,
  OGP_IMAGE_ALLOWED_MIMES,
  OGP_USER_AGENT,
} from '../../constants/ogp'
import {
  resolveAndCheckDns,
  validateExternalUrl,
} from './validateUrl'
import type { HttpClient, HttpGetOptions } from './httpClient'

/**
 * 画像保存先のデフォルトディレクトリ (リポジトリ root からの相対)。
 * `public/` 配下に置くことで Nuxt の静的配信対象となり、`/ogp-images/`
 * として配信される。
 */
const DEFAULT_OUTPUT_DIR = 'public/ogp-images'

/**
 * 自サーバ配信時の URL 接頭辞。`urlPrefix + '/' + filename` で最終 URL を
 * 組み立てる。
 */
const DEFAULT_URL_PREFIX = '/ogp-images'

/**
 * MIME Type → 保存ファイル拡張子のマップ。
 *
 * `OGP_IMAGE_ALLOWED_MIMES` に含まれる MIME のみをキーとする。SVG は
 * `application/xml` を内包できスクリプト埋め込み余地があるため、意図的に
 * 除外する (設計 v4 Sec-C2)。
 */
const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/**
 * `node:fs/promises` のうち本モジュールが必要とする最小サブセット。テストで
 * fake fs を注入しやすいよう interface として切る。
 */
export interface DownloadImageFs {
  writeFile(path: string, data: Uint8Array): Promise<void>
  mkdir(path: string, opts: { recursive: true }): Promise<string | undefined>
}

export interface DownloadImageDeps {
  /** Layer 2 HttpClient。本番は `createNodeHttpClient()`。 */
  readonly client: HttpClient
  /**
   * 画像取得時の HTTP オプション。未指定なら OGP 既定値を使う。
   * ホスト別にタイムアウトを短くしたい等のユースケースでは呼出側で指定可能。
   */
  readonly httpOptions?: HttpGetOptions
  /** node:fs/promises の差替え可能サブセット。テスト用。 */
  readonly fs?: DownloadImageFs
  /**
   * 保存ディレクトリ。既定 `public/ogp-images`。ディレクトリ末尾に `/` は
   * 含めない形を期待する。
   */
  readonly outputDir?: string
  /**
   * 自サーバ配信用 URL 接頭辞。既定 `/ogp-images`。こちらも末尾に `/` は
   * 含めない。
   */
  readonly urlPrefix?: string
  /** DNS lookup の差替え。SSRF 検査用。テストで fake を渡す。 */
  readonly resolveDns?: (host: string) => Promise<readonly string[]>
}

/**
 * 許可 MIME の any1 に該当するかを型レベルで narrow しつつ判定する。
 */
function isAllowedMime(
  value: string,
): value is typeof OGP_IMAGE_ALLOWED_MIMES[number] {
  return (OGP_IMAGE_ALLOWED_MIMES as readonly string[]).includes(value)
}

/**
 * `Content-Type` ヘッダ文字列から MIME 部のみを小文字化して返す。
 * `image/png; charset=utf-8` のような parameter を除去する。
 */
function parseMime(contentType: string | undefined): string {
  if (typeof contentType !== 'string') {
    return ''
  }
  const [mime] = contentType.split(';')
  return (mime ?? '').trim().toLowerCase()
}

/**
 * SHA-1 ハッシュで URL → ファイル名を構築する。拡張子は MIME ごとに
 * `MIME_TO_EXTENSION` から選ぶ。
 */
function buildFileName(imageUrl: string, mime: string): string | null {
  const extension = MIME_TO_EXTENSION[mime]
  if (extension === undefined) {
    return null
  }
  const hash = createHash('sha1').update(imageUrl).digest('hex')
  return `${hash}.${extension}`
}

/**
 * URL / DNS の検証を行い、public unicast でなければ null を返す (= 呼出側は
 * 画像 DL を諦める)。
 */
async function validateImageUrl(
  imageUrl: string,
  resolveDns: DownloadImageDeps['resolveDns'],
): Promise<true | null> {
  const stringResult = validateExternalUrl(imageUrl)
  if (!stringResult.ok) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  }
  catch {
    return null
  }
  const dnsResult = await resolveAndCheckDns(parsed.hostname, resolveDns)
  if (!dnsResult.ok) {
    return null
  }
  return true
}

/**
 * og:image URL を取得し、許可 MIME のみ自サーバ配信パスに保存する。
 * 失敗時は例外を投げず null を返す。
 *
 * @returns 成功時: 自サーバ配信パス (例: `/ogp-images/abc.png`)、失敗時: null
 */
export async function downloadImage(
  imageUrl: string,
  deps: DownloadImageDeps,
): Promise<string | null> {
  const validated = await validateImageUrl(imageUrl, deps.resolveDns)
  if (validated === null) {
    return null
  }

  const httpOptions: HttpGetOptions = deps.httpOptions ?? {
    timeoutMs: OGP_FETCH_TIMEOUT_MS,
    maxBytes: OGP_FETCH_MAX_BYTES,
    maxRedirects: OGP_FETCH_MAX_REDIRECTS,
    userAgent: OGP_USER_AGENT,
    credentials: 'omit',
  }

  let response: Awaited<ReturnType<HttpClient['get']>>
  try {
    response = await deps.client.get(imageUrl, httpOptions)
  }
  catch {
    // サイズ超過 / タイムアウト / ネットワーク失敗など。すべて null へ丸める。
    return null
  }

  const mime = parseMime(response.headers['content-type'])
  if (!isAllowedMime(mime)) {
    return null
  }

  const fileName = buildFileName(imageUrl, mime)
  if (fileName === null) {
    return null
  }

  const outputDir = deps.outputDir ?? DEFAULT_OUTPUT_DIR
  const urlPrefix = deps.urlPrefix ?? DEFAULT_URL_PREFIX

  let fs: DownloadImageFs
  if (deps.fs !== undefined) {
    fs = deps.fs
  }
  else {
    fs = await loadDefaultFs()
  }

  try {
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(`${outputDir}/${fileName}`, response.body)
  }
  catch {
    return null
  }

  return `${urlPrefix}/${fileName}`
}

/**
 * `node:fs/promises` を読み込んで本モジュール用 interface に合わせる。
 */
async function loadDefaultFs(): Promise<DownloadImageFs> {
  const fs = await import('node:fs/promises')
  return {
    writeFile: (path, data) => fs.writeFile(path, data),
    mkdir: async (path, opts) => fs.mkdir(path, opts),
  }
}
