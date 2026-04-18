/**
 * `utils/ogp/fetchOgp.ts` (fetchOgp) のユニットテスト。
 *
 * カバー範囲:
 *   - cache hit で client.get / DNS / extract が呼ばれない
 *   - cache に失敗が記録されている (record === null) と short-circuit される
 *   - 正常 fetch → sanitize → record 返却
 *   - DNS 段階で private IP → failure (cache に失敗を保存)
 *   - URL 文字列段階で scheme 違反 → failure
 *   - client が throw → failure (fetch_failed:* の reason)
 *   - extractOgp が throw → failure (extract_failed:* の reason)
 *   - sanitize で url が空 → failure (sanitize_url_empty)
 *   - imageDownloader 未指定 → imagePath: null
 *   - imageDownloader 指定 + 成功 → imagePath: 受け取り値
 *   - imageDownloader が throw → imagePath: null だが record は返る
 *
 * 全層を fake で差し替え、ネットワーク非依存。
 */
import { describe, expect, it } from 'vitest'
import { fetchOgp } from '../../../utils/ogp/fetchOgp'
import type { FetchOgpDeps, OgpFailure } from '../../../utils/ogp/fetchOgp'
import type {
  HttpClient,
  HttpGetOptions,
  HttpResponse,
} from '../../../utils/ogp/httpClient'
import type {
  OgpCache,
  OgpCacheEntry,
  OgpRecord,
} from '../../../utils/ogp/ogpCache'
import type { RawOgp } from '../../../utils/ogp/sanitizeOgp'
import {
  OGP_FETCH_MAX_BYTES,
  OGP_FETCH_MAX_REDIRECTS,
  OGP_FETCH_TIMEOUT_MS,
  OGP_USER_AGENT,
} from '../../../constants/ogp'

const TARGET_URL = 'https://example.com/article'
const FIXED_NOW_MS = 1_700_000_000_000

const HTTP_OPTIONS: HttpGetOptions = {
  timeoutMs: OGP_FETCH_TIMEOUT_MS,
  maxBytes: OGP_FETCH_MAX_BYTES,
  maxRedirects: OGP_FETCH_MAX_REDIRECTS,
  userAgent: OGP_USER_AGENT,
  credentials: 'omit',
}

/** in-memory な OgpCache 実装。テスト内の状態を Map に保持。 */
function makeMemoryCache(): { cache: OgpCache; storage: Map<string, OgpCacheEntry> } {
  const storage = new Map<string, OgpCacheEntry>()
  const cache: OgpCache = {
    async get(url) {
      return storage.get(url) ?? null
    },
    async set(url, entry) {
      storage.set(url, entry)
    },
  }
  return { cache, storage }
}

/** 呼び出し履歴付きの fake HttpClient。 */
function makeFakeClient(
  responses: Map<string, HttpResponse | Error>,
): { client: HttpClient; calls: string[] } {
  const calls: string[] = []
  const client: HttpClient = {
    async get(url) {
      calls.push(url)
      const value = responses.get(url)
      if (value === undefined) {
        throw new Error(`fake client: no response for ${url}`)
      }
      if (value instanceof Error) {
        throw value
      }
      return value
    },
  }
  return { client, calls }
}

function buildHtmlResponse(html: string): HttpResponse {
  return {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: new TextEncoder().encode(html),
    finalUrl: TARGET_URL,
  }
}

/** 全ホストを 8.8.8.8 (= 公開 IP) に解決する fake DNS。 */
const PUBLIC_DNS = async (): Promise<readonly string[]> => ['8.8.8.8']
/** 全ホストを 10.0.0.1 (= private) に解決する fake DNS。 */
const PRIVATE_DNS = async (): Promise<readonly string[]> => ['10.0.0.1']

const SAMPLE_RAW: RawOgp = {
  title: 'sample title',
  description: 'sample description',
  url: TARGET_URL,
  imageUrl: 'https://example.com/og.png',
  siteName: 'example',
}

function buildExtractFn(raw: RawOgp = SAMPLE_RAW): { fn: FetchOgpDeps['extractOgp']; calls: number } {
  const calls = { count: 0 }
  const fn: FetchOgpDeps['extractOgp'] = () => {
    calls.count += 1
    return raw
  }
  return { fn, get calls() { return calls.count } }
}

function buildBaseDeps(overrides: Partial<FetchOgpDeps> = {}): FetchOgpDeps {
  const { cache } = makeMemoryCache()
  const { client } = makeFakeClient(new Map([
    [TARGET_URL, buildHtmlResponse('<html></html>')],
  ]))
  return {
    cache,
    client,
    extractOgp: () => SAMPLE_RAW,
    httpOptions: HTTP_OPTIONS,
    now: () => FIXED_NOW_MS,
    resolveDns: PUBLIC_DNS,
    ...overrides,
  }
}

function isFailure(result: OgpRecord | OgpFailure): result is OgpFailure {
  return (result as OgpFailure).ok === false
}

describe('fetchOgp', () => {
  it('returns the cached record without calling client / extract / DNS', async () => {
    const cachedRecord: OgpRecord = {
      url: TARGET_URL,
      title: 'cached',
      description: 'cached desc',
      imagePath: '/ogp-images/x.png',
      siteName: 'cached site',
      fetchedAt: new Date(FIXED_NOW_MS).toISOString(),
    }
    const { cache } = makeMemoryCache()
    await cache.set(TARGET_URL, {
      record: cachedRecord,
      fetchedAt: FIXED_NOW_MS,
      expiresAt: FIXED_NOW_MS + 1000,
    })
    const { client, calls } = makeFakeClient(new Map())
    let dnsCalled = 0
    const resolveDns = async (): Promise<readonly string[]> => {
      dnsCalled += 1
      return ['8.8.8.8']
    }
    const extractCalls = { count: 0 }
    const extractOgp: FetchOgpDeps['extractOgp'] = () => {
      extractCalls.count += 1
      return SAMPLE_RAW
    }

    const result = await fetchOgp(TARGET_URL, {
      cache,
      client,
      extractOgp,
      httpOptions: HTTP_OPTIONS,
      now: () => FIXED_NOW_MS,
      resolveDns,
    })

    expect(isFailure(result)).toBe(false)
    expect(result).toEqual(cachedRecord)
    expect(calls).toHaveLength(0)
    expect(dnsCalled).toBe(0)
    expect(extractCalls.count).toBe(0)
  })

  it('returns failure when cache holds a failure entry', async () => {
    const { cache } = makeMemoryCache()
    await cache.set(TARGET_URL, {
      record: null,
      fetchedAt: FIXED_NOW_MS,
      expiresAt: FIXED_NOW_MS + 1000,
    })
    const { client } = makeFakeClient(new Map())

    const result = await fetchOgp(TARGET_URL, buildBaseDeps({ cache, client }))

    expect(isFailure(result)).toBe(true)
    expect((result as OgpFailure).reason).toBe('cached_failure')
  })

  it('returns failure for a private IP host (cached as failure)', async () => {
    const { cache, storage } = makeMemoryCache()
    const result = await fetchOgp(TARGET_URL, buildBaseDeps({
      cache,
      resolveDns: PRIVATE_DNS,
    }))

    expect(isFailure(result)).toBe(true)
    expect((result as OgpFailure).reason).toContain('dns_invalid:ip_private')
    // 失敗もキャッシュに記録される。
    const stored = storage.get(TARGET_URL)
    expect(stored?.record).toBeNull()
  })

  it('returns failure for unsupported scheme without calling client', async () => {
    const { cache } = makeMemoryCache()
    const { client, calls } = makeFakeClient(new Map())

    const result = await fetchOgp('file:///etc/passwd', buildBaseDeps({ cache, client }))

    expect(isFailure(result)).toBe(true)
    expect((result as OgpFailure).reason).toContain('url_invalid:scheme')
    expect(calls).toHaveLength(0)
  })

  it('returns failure when client throws', async () => {
    const { cache } = makeMemoryCache()
    const { client } = makeFakeClient(new Map([
      [TARGET_URL, new Error('ECONNRESET')],
    ]))

    const result = await fetchOgp(TARGET_URL, buildBaseDeps({ cache, client }))

    expect(isFailure(result)).toBe(true)
    expect((result as OgpFailure).reason).toMatch(/^fetch_failed:/)
  })

  it('returns failure when extractOgp throws', async () => {
    const result = await fetchOgp(TARGET_URL, buildBaseDeps({
      extractOgp: () => {
        throw new Error('parse error')
      },
    }))

    expect(isFailure(result)).toBe(true)
    expect((result as OgpFailure).reason).toMatch(/^extract_failed:/)
  })

  it('returns failure when sanitize empties out url', async () => {
    // sanitize の入口に渡る url 自体は valid だが、extract が javascript: を
    // 返してきたケースを再現する。
    const result = await fetchOgp(TARGET_URL, buildBaseDeps({
      // eslint-disable-next-line no-script-url
      extractOgp: () => ({ title: 't', url: 'javascript:alert(1)' }),
    }))

    expect(isFailure(result)).toBe(true)
    expect((result as OgpFailure).reason).toBe('sanitize_url_empty')
  })

  it('returns OgpRecord on full success path with imagePath: null when downloader is absent', async () => {
    const { cache, storage } = makeMemoryCache()

    const result = await fetchOgp(TARGET_URL, buildBaseDeps({ cache }))

    expect(isFailure(result)).toBe(false)
    if (isFailure(result)) {
      throw new Error('unreachable')
    }
    expect(result.title).toBe('sample title')
    expect(result.description).toBe('sample description')
    expect(result.url).toBe(TARGET_URL)
    expect(result.imagePath).toBeNull()
    expect(result.siteName).toBe('example')
    // record がキャッシュに保存されていること。
    const stored = storage.get(TARGET_URL)
    expect(stored?.record).toEqual(result)
  })

  it('uses imageDownloader when provided and stores returned local path', async () => {
    const result = await fetchOgp(TARGET_URL, buildBaseDeps({
      imageDownloader: async (imageUrl) => {
        expect(imageUrl).toBe('https://example.com/og.png')
        return '/ogp-images/abc.png'
      },
    }))

    expect(isFailure(result)).toBe(false)
    if (isFailure(result)) {
      throw new Error('unreachable')
    }
    expect(result.imagePath).toBe('/ogp-images/abc.png')
  })

  it('falls back to imagePath: null when imageDownloader throws', async () => {
    const result = await fetchOgp(TARGET_URL, buildBaseDeps({
      imageDownloader: async () => {
        throw new Error('image fetch failed')
      },
    }))

    expect(isFailure(result)).toBe(false)
    if (isFailure(result)) {
      throw new Error('unreachable')
    }
    expect(result.imagePath).toBeNull()
  })

  it('does not call imageDownloader when imageUrl is null after sanitize', async () => {
    let downloaderCalls = 0
    const result = await fetchOgp(TARGET_URL, buildBaseDeps({
      extractOgp: () => ({ title: 't', url: TARGET_URL, imageUrl: undefined }),
      imageDownloader: async () => {
        downloaderCalls += 1
        return '/should/not/be/used.png'
      },
    }))

    expect(isFailure(result)).toBe(false)
    if (isFailure(result)) {
      throw new Error('unreachable')
    }
    expect(result.imagePath).toBeNull()
    expect(downloaderCalls).toBe(0)
  })
})
