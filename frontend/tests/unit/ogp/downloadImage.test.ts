/**
 * `utils/ogp/downloadImage.ts` (downloadImage) のユニットテスト。
 *
 * カバー範囲:
 *   - image/png 取得 → 保存 → `/ogp-images/<sha1>.png` パスが返る
 *   - image/svg+xml は許可 MIME 外 → null (SVG 禁止、設計 v4 Sec-C2)
 *   - private IP ホストは DNS 段階で null
 *   - HttpClient が throw (サイズ超過相当) → null
 *   - scheme が invalid (`javascript:`) → null
 *   - writeFile が throw → null (致命的失敗にしない)
 *
 * 全層 fake のため、ネットワーク / ディスク I/O は発生しない。
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { downloadImage } from '../../../utils/ogp/downloadImage'
import type { DownloadImageFs } from '../../../utils/ogp/downloadImage'
import type {
  HttpClient,
  HttpResponse,
} from '../../../utils/ogp/httpClient'

const IMAGE_URL = 'https://example.com/og.png'
const PRIVATE_IMAGE_URL = 'https://internal.example.com/og.png'

/** 画像バイト列 (中身は 0x89,0x50,0x4E,0x47 の PNG 署名だが形式は問わない)。 */
const FAKE_PNG_BODY = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

/** 全ホストを 8.8.8.8 に解決する公開 IP 向け fake DNS。 */
const PUBLIC_DNS = async (): Promise<readonly string[]> => ['8.8.8.8']
/** 全ホストを 10.0.0.1 (private) に解決する fake DNS。 */
const PRIVATE_DNS = async (): Promise<readonly string[]> => ['10.0.0.1']

function buildHttpResponse(
  body: Uint8Array,
  contentType: string,
  finalUrl: string,
): HttpResponse {
  return {
    status: 200,
    headers: { 'content-type': contentType },
    body,
    finalUrl,
  }
}

/**
 * in-memory fake fs。`writeFile` / `mkdir` の呼び出しを記録する。
 */
function makeFakeFs(): {
  fs: DownloadImageFs
  written: Map<string, Uint8Array>
  mkdirCalls: string[]
} {
  const written = new Map<string, Uint8Array>()
  const mkdirCalls: string[] = []
  const fs: DownloadImageFs = {
    async writeFile(path, data) {
      written.set(path, data)
    },
    async mkdir(path) {
      mkdirCalls.push(path)
      return undefined
    },
  }
  return { fs, written, mkdirCalls }
}

/** 1 URL にレスポンス or Error を紐づけた fake HttpClient。 */
function makeFakeClient(
  responses: Map<string, HttpResponse | Error>,
): HttpClient {
  return {
    async get(url) {
      const value = responses.get(url)
      if (value === undefined) {
        throw new Error(`no response for ${url}`)
      }
      if (value instanceof Error) {
        throw value
      }
      return value
    },
  }
}

describe('downloadImage', () => {
  it('saves an image/png and returns the self-hosted path', async () => {
    const client = makeFakeClient(new Map([
      [IMAGE_URL, buildHttpResponse(FAKE_PNG_BODY, 'image/png', IMAGE_URL)],
    ]))
    const { fs, written, mkdirCalls } = makeFakeFs()

    const result = await downloadImage(IMAGE_URL, {
      client,
      fs,
      resolveDns: PUBLIC_DNS,
    })

    const expectedHash = createHash('sha1').update(IMAGE_URL).digest('hex')
    expect(result).toBe(`/ogp-images/${expectedHash}.png`)
    expect(mkdirCalls).toContain('public/ogp-images')
    expect(written.get(`public/ogp-images/${expectedHash}.png`)).toEqual(
      FAKE_PNG_BODY,
    )
  })

  it('respects custom outputDir and urlPrefix', async () => {
    const client = makeFakeClient(new Map([
      [IMAGE_URL, buildHttpResponse(FAKE_PNG_BODY, 'image/jpeg', IMAGE_URL)],
    ]))
    const { fs, written } = makeFakeFs()

    const result = await downloadImage(IMAGE_URL, {
      client,
      fs,
      outputDir: '.tmp/images',
      urlPrefix: '/images',
      resolveDns: PUBLIC_DNS,
    })

    const expectedHash = createHash('sha1').update(IMAGE_URL).digest('hex')
    expect(result).toBe(`/images/${expectedHash}.jpg`)
    expect(written.has(`.tmp/images/${expectedHash}.jpg`)).toBe(true)
  })

  it('rejects image/svg+xml (SVG not allowed)', async () => {
    const client = makeFakeClient(new Map([
      [IMAGE_URL, buildHttpResponse(FAKE_PNG_BODY, 'image/svg+xml', IMAGE_URL)],
    ]))
    const { fs, written } = makeFakeFs()

    const result = await downloadImage(IMAGE_URL, {
      client,
      fs,
      resolveDns: PUBLIC_DNS,
    })

    expect(result).toBeNull()
    expect(written.size).toBe(0)
  })

  it('returns null for an unknown MIME type', async () => {
    const client = makeFakeClient(new Map([
      [IMAGE_URL, buildHttpResponse(FAKE_PNG_BODY, 'application/octet-stream', IMAGE_URL)],
    ]))
    const { fs } = makeFakeFs()

    const result = await downloadImage(IMAGE_URL, {
      client,
      fs,
      resolveDns: PUBLIC_DNS,
    })

    expect(result).toBeNull()
  })

  it('returns null when DNS resolves to a private IP', async () => {
    const client = makeFakeClient(new Map([
      [PRIVATE_IMAGE_URL, buildHttpResponse(FAKE_PNG_BODY, 'image/png', PRIVATE_IMAGE_URL)],
    ]))
    const { fs, written } = makeFakeFs()

    const result = await downloadImage(PRIVATE_IMAGE_URL, {
      client,
      fs,
      resolveDns: PRIVATE_DNS,
    })

    expect(result).toBeNull()
    expect(written.size).toBe(0)
  })

  it('returns null when scheme is not http(s)', async () => {
    const client = makeFakeClient(new Map())
    const { fs } = makeFakeFs()

    const result = await downloadImage('javascript:alert(1)', {
      client,
      fs,
      resolveDns: PUBLIC_DNS,
    })

    expect(result).toBeNull()
  })

  it('returns null when HttpClient throws (network or size exceeded)', async () => {
    const client = makeFakeClient(new Map([
      [IMAGE_URL, new Error('response body exceeded maxBytes')],
    ]))
    const { fs } = makeFakeFs()

    const result = await downloadImage(IMAGE_URL, {
      client,
      fs,
      resolveDns: PUBLIC_DNS,
    })

    expect(result).toBeNull()
  })

  it('returns null when fs.writeFile throws', async () => {
    const client = makeFakeClient(new Map([
      [IMAGE_URL, buildHttpResponse(FAKE_PNG_BODY, 'image/png', IMAGE_URL)],
    ]))
    const fs: DownloadImageFs = {
      async writeFile() {
        throw new Error('disk full')
      },
      async mkdir() {
        return undefined
      },
    }

    const result = await downloadImage(IMAGE_URL, {
      client,
      fs,
      resolveDns: PUBLIC_DNS,
    })

    expect(result).toBeNull()
  })
})
