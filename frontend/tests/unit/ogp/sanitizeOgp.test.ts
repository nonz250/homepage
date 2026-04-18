/**
 * `utils/ogp/sanitizeOgp.ts` (sanitizeOgp) のユニットテスト。
 *
 * カバー範囲:
 *   - 正常系 (HTML / scheme 共に問題なし)
 *   - HTML タグ入り title/description が plain text に平坦化される
 *   - title / description が最大長で切り詰められる
 *   - imageUrl / url が `javascript:` / `data:` 等で null / 空に倒される
 *   - 欠損 (undefined) フィールドは空文字 / null へ正規化される
 *   - 過剰に長い URL (max 超過) は null
 *   - siteName の空文字 / 空白のみは null
 *
 * これらのテストは sanitizer の振る舞いを保証し、上位 (`fetchOgp`) が「url が
 * 空なら failure」と判定する前提を担保する。
 */
import { describe, expect, it } from 'vitest'
import { sanitizeOgp } from '../../../utils/ogp/sanitizeOgp'
import {
  OGP_DESCRIPTION_MAX_LENGTH,
  OGP_TITLE_MAX_LENGTH,
  OGP_URL_MAX_LENGTH,
} from '../../../constants/ogp'

describe('sanitizeOgp', () => {
  it('returns clean fields for a fully valid input', () => {
    const result = sanitizeOgp({
      title: 'Hello, world!',
      description: 'A short description.',
      url: 'https://example.com/article',
      imageUrl: 'https://example.com/og.png',
      siteName: 'Example',
    })

    expect(result.title).toBe('Hello, world!')
    expect(result.description).toBe('A short description.')
    expect(result.url).toBe('https://example.com/article')
    expect(result.imageUrl).toBe('https://example.com/og.png')
    expect(result.siteName).toBe('Example')
  })

  it('strips HTML tags from title and description', () => {
    const result = sanitizeOgp({
      title: '<script>alert(1)</script>Hello',
      description: 'foo<img src=x onerror=alert(1)>bar',
      url: 'https://example.com/',
    })

    expect(result.title).not.toContain('<')
    expect(result.title).not.toContain('script')
    // sanitize-html は <script> タグの中身も削除するため `Hello` のみが残る。
    expect(result.title).toBe('Hello')
    expect(result.description).not.toContain('<')
    // <img> タグごと除去されるので `foobar` だけ残る。
    expect(result.description).toBe('foobar')
  })

  it('truncates title beyond max length', () => {
    const longTitle = 'a'.repeat(OGP_TITLE_MAX_LENGTH + 50)
    const result = sanitizeOgp({
      title: longTitle,
      url: 'https://example.com/',
    })

    expect(result.title.length).toBe(OGP_TITLE_MAX_LENGTH)
  })

  it('truncates description beyond max length', () => {
    const longDescription = 'b'.repeat(OGP_DESCRIPTION_MAX_LENGTH + 100)
    const result = sanitizeOgp({
      description: longDescription,
      url: 'https://example.com/',
    })

    expect(result.description.length).toBe(OGP_DESCRIPTION_MAX_LENGTH)
  })

  it('rejects javascript: scheme on imageUrl', () => {
    const result = sanitizeOgp({
      title: 'x',
      url: 'https://example.com/',
      // eslint-disable-next-line no-script-url
      imageUrl: 'javascript:alert(1)',
    })

    expect(result.imageUrl).toBeNull()
  })

  it('rejects data: scheme on url (treats it as empty)', () => {
    const result = sanitizeOgp({
      url: 'data:text/html,<h1>x</h1>',
    })

    expect(result.url).toBe('')
  })

  it('returns empty url when url is missing', () => {
    const result = sanitizeOgp({
      title: 'no url',
    })

    expect(result.url).toBe('')
    expect(result.imageUrl).toBeNull()
  })

  it('returns empty strings for missing title and description', () => {
    const result = sanitizeOgp({
      url: 'https://example.com/',
    })

    expect(result.title).toBe('')
    expect(result.description).toBe('')
  })

  it('rejects URL longer than max length', () => {
    const longPath = 'a'.repeat(OGP_URL_MAX_LENGTH + 100)
    const longUrl = `https://example.com/${longPath}`
    const result = sanitizeOgp({ url: longUrl })

    expect(result.url).toBe('')
  })

  it('returns null for siteName when it is empty after sanitize', () => {
    const result = sanitizeOgp({
      url: 'https://example.com/',
      siteName: '   ',
    })

    expect(result.siteName).toBeNull()
  })

  it('preserves HTML entities as-is in title (no double decode)', () => {
    // sanitize-html はデフォルトでテキスト中のエンティティをデコードしない。
    // ブラウザ側の表示時にデコードされるため XSS にはならず、サニタイザ側で
    // 二重デコードしない方が攻撃面を小さく保てる。
    const result = sanitizeOgp({
      title: 'Tom &amp; Jerry',
      url: 'https://example.com/',
    })

    expect(result.title).toBe('Tom &amp; Jerry')
  })

  it('rejects http URL with disallowed port (port-level check)', () => {
    const result = sanitizeOgp({
      url: 'http://example.com:22/',
    })

    expect(result.url).toBe('')
  })
})
