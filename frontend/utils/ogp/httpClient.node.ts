/**
 * Node 環境における `HttpClient` 本番実装。
 *
 * Node 24 標準の `fetch` をラップし、以下のハードリミットを自前で適用する:
 *   1. リダイレクトを「手動」で 1 ホップずつ追跡し、各ホップで URL バリデーション
 *      (`validateExternalUrl` + `resolveAndCheckDns`) を再適用する。
 *      → リダイレクト先が SSRF 対象になっている古典的な抜け道を塞ぐ。
 *   2. `maxRedirects` を超えたら throw する。
 *   3. `AbortController` で `timeoutMs` を強制する。タイムアウト発生時は中断。
 *   4. レスポンスボディを ReadableStream として読み、累積バイト数が `maxBytes`
 *      を超えたら直ちに reader を cancel して throw する。
 *      (Content-Length ヘッダだけを信用すると嘘の値で迂回されうるため、実バイト
 *       数を監視する。)
 *   5. `Cookie` 等を送信しないよう `credentials: 'omit'` を fetch に渡す。
 *      また `User-Agent` ヘッダを必ず設定する。
 *
 * 依存は DI で差替え可能にし、test では fetch / DNS / validator を fake で
 * 渡すことでネットワークを使わずに 5 つの分岐 (正常 / リダイレクト OK /
 * リダイレクト過多 / SSRF 検知 / タイムアウト / サイズ超過) を網羅できる。
 */
import {
  resolveAndCheckDns,
  validateExternalUrl,
} from './validateUrl'
import type { HttpClient, HttpGetOptions, HttpResponse } from './httpClient'

/**
 * リダイレクト判定とみなす HTTP ステータスコード。
 * fetch の `redirect: 'manual'` で受け取る代表的な 3xx 群。
 */
const REDIRECT_STATUSES: readonly number[] = [301, 302, 303, 307, 308] as const

/**
 * Node 24 の `fetch` シグネチャに合致する関数型。
 * `globalThis.fetch` をそのまま注入できる。
 */
type FetchImpl = typeof fetch

export interface NodeHttpClientDeps {
  /** 差替え可能な fetch 実装。省略時は `globalThis.fetch`。 */
  readonly fetchImpl?: FetchImpl
  /**
   * 差替え可能な DNS lookup。`resolveAndCheckDns` に渡す。省略時は
   * `dns.promises.lookup` (`validateUrl.ts` の defaultLookup) を使う。
   */
  readonly resolveDns?: (host: string) => Promise<readonly string[]>
  /** 差替え可能な URL 文字列バリデータ。 */
  readonly validateUrl?: typeof validateExternalUrl
}

/**
 * fetch のレスポンスヘッダを Record<string, string> に小文字キーで詰め直す。
 */
function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value
  })
  return record
}

/**
 * ボディを ReadableStream から読み込み、累積バイト数が `maxBytes` を超えたら
 * 即座に reader を cancel して throw する。Content-Length に依存せずに実バイト
 * 数で判定する。
 */
async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (response.body === null) {
    return new Uint8Array(0)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new Error(`response body exceeded maxBytes (${maxBytes})`)
      }
      chunks.push(value)
    }
  }
  finally {
    // reader が解放されていることを保証する。すでに cancel/解放済みなら
    // releaseLock が throw する場合があるため握りつぶす。
    try {
      reader.releaseLock()
    }
    catch {
      // intentionally ignored
    }
  }
  // チャンクを 1 本の Uint8Array に結合する。
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

/**
 * 1 ホップ分の fetch を実行し、`Response` を返す。
 * timeout は `AbortController` を新規生成して付け、戻った後に必ず clear する。
 */
async function fetchOnce(
  url: string,
  opts: HttpGetOptions,
  fetchImpl: FetchImpl,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  try {
    return await fetchImpl(url, {
      method: 'GET',
      headers: { 'user-agent': opts.userAgent },
      redirect: 'manual',
      credentials: opts.credentials,
      signal: controller.signal,
    })
  }
  finally {
    clearTimeout(timer)
  }
}

/**
 * Node 環境向けの HttpClient ファクトリ。`createNodeHttpClient()` の戻り値を
 * 上位 (`fetchOgp`) が依存する。
 */
export function createNodeHttpClient(deps: NodeHttpClientDeps = {}): HttpClient {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch
  const validateUrl = deps.validateUrl ?? validateExternalUrl
  const resolveDns = deps.resolveDns

  return {
    async get(url: string, opts: HttpGetOptions): Promise<HttpResponse> {
      let currentUrl = url
      let hops = 0
      while (true) {
        // 1) URL 段階の検査 (各ホップで再検査する)。
        const stringResult = validateUrl(currentUrl)
        if (!stringResult.ok) {
          throw new Error(
            `url validation failed: ${stringResult.reason} (${currentUrl})`,
          )
        }
        // 2) DNS 段階の検査。
        const parsed = new URL(currentUrl)
        const dnsResult = await resolveAndCheckDns(parsed.hostname, resolveDns)
        if (!dnsResult.ok) {
          throw new Error(
            `dns validation failed: ${dnsResult.reason} (${currentUrl})`,
          )
        }

        // 3) 1 ホップ分の fetch を実行。
        const response = await fetchOnce(currentUrl, opts, fetchImpl)

        if (REDIRECT_STATUSES.includes(response.status)) {
          // body は読まずに drain。`cancel` で reader を解放する。
          if (response.body !== null) {
            await response.body.cancel()
          }
          const location = response.headers.get('location')
          if (location === null || location.length === 0) {
            throw new Error(
              `redirect status ${response.status} without Location header`,
            )
          }
          // 次ホップへ。相対 URL も絶対 URL も `URL` で吸収できる。
          const nextUrl = new URL(location, currentUrl).toString()
          hops += 1
          if (hops > opts.maxRedirects) {
            throw new Error(`too many redirects (max=${opts.maxRedirects})`)
          }
          currentUrl = nextUrl
          continue
        }

        const body = await readBodyWithLimit(response, opts.maxBytes)
        return {
          status: response.status,
          headers: headersToRecord(response.headers),
          body,
          finalUrl: currentUrl,
        }
      }
    },
  }
}
