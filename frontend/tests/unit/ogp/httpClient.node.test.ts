/**
 * `utils/ogp/httpClient.node.ts` (createNodeHttpClient) のユニットテスト。
 *
 * カバー範囲:
 *   - 正常系 (200 + ボディ取得)
 *   - リダイレクト追跡 OK (1 ホップ)
 *   - maxRedirects 超過で throw
 *   - リダイレクト先が SSRF 対象 (private IP) で throw
 *   - URL 文字列段階の検査失敗 (file:// 等) で throw
 *   - タイムアウト発火で throw (AbortController)
 *   - レスポンスボディが maxBytes 超過で throw
 *
 * fake fetch / fake DNS / fake validator を DI して、ネットワーク非依存。
 */
import { describe, expect, it } from 'vitest'
import { createNodeHttpClient } from '../../../utils/ogp/httpClient.node'
import type { HttpGetOptions } from '../../../utils/ogp/httpClient'
import {
  OGP_FETCH_MAX_REDIRECTS,
  OGP_USER_AGENT,
} from '../../../constants/ogp'

const SHORT_TIMEOUT_MS = 50
const SMALL_MAX_BYTES = 32

const SAMPLE_OPTS: HttpGetOptions = {
  timeoutMs: 5000,
  maxBytes: 1_000_000,
  maxRedirects: OGP_FETCH_MAX_REDIRECTS,
  userAgent: OGP_USER_AGENT,
  credentials: 'omit',
}

/**
 * URL → Response (or () => Response) を順に返すスクリプト的 fetch。
 * 同じ URL に対する 2 回目以降の呼び出しが必要な場合は配列に複数登録する。
 */
function makeScriptedFetch(script: Map<string, Array<() => Response>>): typeof fetch {
  const cursors = new Map<string, number>()
  const fetchImpl = ((async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const seq = script.get(url)
    if (seq === undefined) {
      throw new Error(`scripted fetch: no entry for ${url}`)
    }
    const idx = cursors.get(url) ?? 0
    if (idx >= seq.length) {
      throw new Error(`scripted fetch: exhausted entries for ${url}`)
    }
    cursors.set(url, idx + 1)
    return seq[idx]()
  }) as typeof fetch)
  return fetchImpl
}

/**
 * テスト用の Response ビルダ。fetch の Response はテキスト/バイナリ両対応で
 * 構築できるが、本テストでは bytes (Uint8Array) で渡すのが扱いやすい。
 */
function buildBytesResponse(
  body: Uint8Array,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200
  const headers = init.headers ?? { 'content-type': 'text/html' }
  // Node 24 の Uint8Array は ArrayBufferLike (= SharedArrayBuffer も含む) で
  // 推論されるため、`Response` の BodyInit と直接合わない。`buffer` を取り出して
  // ArrayBuffer 確定でわたす。
  const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
  return new Response(arrayBuffer, { status, headers })
}

function buildRedirectResponse(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { location },
  })
}

/** 全ホストを 8.8.8.8 に解決する fake DNS。 */
const PUBLIC_DNS = async (): Promise<readonly string[]> => ['8.8.8.8']
/** 全ホストを 10.0.0.1 (private) に解決する fake DNS。 */
const PRIVATE_DNS = async (): Promise<readonly string[]> => ['10.0.0.1']

describe('createNodeHttpClient', () => {
  it('returns the response body and status on a normal 200', async () => {
    const html = new TextEncoder().encode('<html><title>x</title></html>')
    const fetchImpl = makeScriptedFetch(new Map([
      ['https://example.com/', [() => buildBytesResponse(html)]],
    ]))
    const client = createNodeHttpClient({ fetchImpl, resolveDns: PUBLIC_DNS })

    const result = await client.get('https://example.com/', SAMPLE_OPTS)

    expect(result.status).toBe(200)
    expect(result.body).toEqual(html)
    expect(result.finalUrl).toBe('https://example.com/')
    expect(result.headers['content-type']).toBe('text/html')
  })

  it('follows a single redirect and exposes the final URL', async () => {
    const finalHtml = new TextEncoder().encode('<html>final</html>')
    const fetchImpl = makeScriptedFetch(new Map([
      ['https://example.com/', [() => buildRedirectResponse('https://example.com/final')]],
      ['https://example.com/final', [() => buildBytesResponse(finalHtml)]],
    ]))
    const client = createNodeHttpClient({ fetchImpl, resolveDns: PUBLIC_DNS })

    const result = await client.get('https://example.com/', SAMPLE_OPTS)

    expect(result.status).toBe(200)
    expect(result.finalUrl).toBe('https://example.com/final')
  })

  it('throws when redirects exceed maxRedirects', async () => {
    const fetchImpl = makeScriptedFetch(new Map([
      ['https://example.com/a', [() => buildRedirectResponse('https://example.com/b')]],
      ['https://example.com/b', [() => buildRedirectResponse('https://example.com/c')]],
      ['https://example.com/c', [() => buildRedirectResponse('https://example.com/d')]],
      ['https://example.com/d', [() => buildRedirectResponse('https://example.com/e')]],
    ]))
    const client = createNodeHttpClient({ fetchImpl, resolveDns: PUBLIC_DNS })

    await expect(
      client.get('https://example.com/a', { ...SAMPLE_OPTS, maxRedirects: 2 }),
    ).rejects.toThrow(/too many redirects/)
  })

  it('rejects when redirect target resolves to a private IP', async () => {
    let dnsCallCount = 0
    // 1 ホップ目 (公開ホスト) の DNS は public、
    // リダイレクト先 (内部ホスト) の DNS は private。
    // 1 度の resolveAndCheckDns で同じ host が 2 回 lookup される点に注意し、
    // 「最初の 2 回は public, 残り 2 回は private」を返す。
    const resolveDns = async (): Promise<readonly string[]> => {
      dnsCallCount += 1
      const lookupsBeforeRedirect = 2
      return dnsCallCount <= lookupsBeforeRedirect ? ['8.8.8.8'] : ['10.0.0.1']
    }
    const fetchImpl = makeScriptedFetch(new Map([
      ['https://public.example.com/', [() => buildRedirectResponse('https://internal.example.com/')]],
      ['https://internal.example.com/', [() => buildBytesResponse(new Uint8Array())]],
    ]))
    const client = createNodeHttpClient({ fetchImpl, resolveDns })

    await expect(
      client.get('https://public.example.com/', SAMPLE_OPTS),
    ).rejects.toThrow(/dns validation failed: ip_private/)
  })

  it('throws when URL string validation fails (e.g. unsupported scheme)', async () => {
    const fetchImpl = makeScriptedFetch(new Map())
    const client = createNodeHttpClient({ fetchImpl, resolveDns: PUBLIC_DNS })

    await expect(
      client.get('file:///etc/passwd', SAMPLE_OPTS),
    ).rejects.toThrow(/url validation failed: scheme/)
  })

  it('throws when DNS validation fails (private IP) without sending fetch', async () => {
    let fetchCalled = 0
    const fetchImpl = (async () => {
      fetchCalled += 1
      return buildBytesResponse(new Uint8Array())
    }) as typeof fetch
    const client = createNodeHttpClient({ fetchImpl, resolveDns: PRIVATE_DNS })

    await expect(
      client.get('https://internal.example.com/', SAMPLE_OPTS),
    ).rejects.toThrow(/dns validation failed: ip_private/)

    // バリデーション失敗時には fetch を呼ばないこと。
    expect(fetchCalled).toBe(0)
  })

  it('aborts and throws when timeout elapses', async () => {
    // fetch 内で signal.aborted を待ち、abort が起きたら AbortError を投げる
    // 振る舞いを fake でエミュレートする。
    const fetchImpl = ((async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const signal = init?.signal as AbortSignal | undefined
      const abortPollIntervalMs = 5
      return new Promise<Response>((_resolve, reject) => {
        const interval = setInterval(() => {
          if (signal?.aborted === true) {
            clearInterval(interval)
            const err = new Error('aborted')
            ;(err as { name: string }).name = 'AbortError'
            reject(err)
          }
        }, abortPollIntervalMs)
      })
    }) as typeof fetch)
    const client = createNodeHttpClient({ fetchImpl, resolveDns: PUBLIC_DNS })

    await expect(
      client.get('https://slow.example.com/', { ...SAMPLE_OPTS, timeoutMs: SHORT_TIMEOUT_MS }),
    ).rejects.toThrow(/aborted/)
  })

  it('throws when response body exceeds maxBytes', async () => {
    // SMALL_MAX_BYTES + 1 バイトの payload。
    const oversize = new Uint8Array(SMALL_MAX_BYTES + 1).fill(65)
    const fetchImpl = makeScriptedFetch(new Map([
      ['https://big.example.com/', [() => buildBytesResponse(oversize)]],
    ]))
    const client = createNodeHttpClient({ fetchImpl, resolveDns: PUBLIC_DNS })

    await expect(
      client.get('https://big.example.com/', { ...SAMPLE_OPTS, maxBytes: SMALL_MAX_BYTES }),
    ).rejects.toThrow(/exceeded maxBytes/)
  })
})
