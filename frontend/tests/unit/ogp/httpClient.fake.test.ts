/**
 * `utils/ogp/httpClient.fake.ts` (FakeHttpClient) のユニットテスト。
 *
 * カバー範囲:
 *   - 登録済み URL で期待レスポンスが返る
 *   - 未登録 URL で throw する
 *   - Error を登録した URL でその Error がそのまま投げられる
 *   - 呼び出し履歴 (`getCallLog`) に GET 内容が記録される
 *   - 取得した履歴を変更しても fake 内部状態に影響しない (immutable な snapshot)
 *
 * これらは fake 自身の挙動を保証する単純なテスト。fetchOgp 本体のテスト時に
 * 「何回呼ばれた / どんな options で呼ばれた」を検証するための土台になる。
 */
import { describe, expect, it } from 'vitest'
import { FakeHttpClient } from '../../../utils/ogp/httpClient.fake'
import type { HttpGetOptions, HttpResponse } from '../../../utils/ogp/httpClient'
import {
  OGP_FETCH_MAX_BYTES,
  OGP_FETCH_MAX_REDIRECTS,
  OGP_FETCH_TIMEOUT_MS,
  OGP_USER_AGENT,
} from '../../../constants/ogp'

const SAMPLE_OPTS: HttpGetOptions = {
  timeoutMs: OGP_FETCH_TIMEOUT_MS,
  maxBytes: OGP_FETCH_MAX_BYTES,
  maxRedirects: OGP_FETCH_MAX_REDIRECTS,
  userAgent: OGP_USER_AGENT,
  credentials: 'omit',
}

function buildSampleResponse(html: string): HttpResponse {
  return {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: new TextEncoder().encode(html),
    finalUrl: 'https://example.com/',
  }
}

describe('FakeHttpClient', () => {
  it('returns the registered response for a known URL', async () => {
    const expected = buildSampleResponse('<html><head><title>x</title></head></html>')
    const client = new FakeHttpClient({
      responses: new Map([
        ['https://example.com/', expected],
      ]),
    })

    const actual = await client.get('https://example.com/', SAMPLE_OPTS)

    expect(actual).toBe(expected)
  })

  it('throws when URL is not registered', async () => {
    const client = new FakeHttpClient({ responses: new Map() })

    await expect(
      client.get('https://unknown.example.com/', SAMPLE_OPTS),
    ).rejects.toThrow(/no registered response/)
  })

  it('throws the registered Error value for failure simulation', async () => {
    const failure = new Error('ECONNRESET')
    const client = new FakeHttpClient({
      responses: new Map([
        ['https://flaky.example.com/', failure],
      ]),
    })

    await expect(
      client.get('https://flaky.example.com/', SAMPLE_OPTS),
    ).rejects.toBe(failure)
  })

  it('records each get() call in the call log with url and options', async () => {
    const expected = buildSampleResponse('<html></html>')
    const client = new FakeHttpClient({
      responses: new Map([
        ['https://example.com/', expected],
      ]),
    })

    await client.get('https://example.com/', SAMPLE_OPTS)
    await client.get('https://example.com/', SAMPLE_OPTS)

    const log = client.getCallLog()
    expect(log).toHaveLength(2)
    expect(log[0].url).toBe('https://example.com/')
    expect(log[0].opts).toBe(SAMPLE_OPTS)
  })

  it('records failed call as well (exception path)', async () => {
    const client = new FakeHttpClient({
      responses: new Map([
        ['https://flaky.example.com/', new Error('boom')],
      ]),
    })

    await expect(
      client.get('https://flaky.example.com/', SAMPLE_OPTS),
    ).rejects.toThrow(/boom/)

    expect(client.getCallLog()).toHaveLength(1)
  })

  it('returns an independent snapshot of the call log', async () => {
    const expected = buildSampleResponse('<html></html>')
    const client = new FakeHttpClient({
      responses: new Map([
        ['https://example.com/', expected],
      ]),
    })

    await client.get('https://example.com/', SAMPLE_OPTS)
    const firstSnapshot = client.getCallLog()
    // getCallLog の戻りが readonly snapshot であり、再取得しても
    // 別のインスタンスが返ること (= 配列がコピーされていること) を確認する。
    const secondSnapshot = client.getCallLog()
    expect(secondSnapshot).not.toBe(firstSnapshot)
    expect(secondSnapshot).toHaveLength(1)
  })
})
