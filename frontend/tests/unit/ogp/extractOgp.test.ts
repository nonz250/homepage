/**
 * `utils/ogp/extractOgp.ts` (extractOgp) のユニットテスト。
 *
 * `open-graph-scraper` は HTML を渡せば fetch せずにパースする仕様なので、
 * テストは完全ローカルで実行できる。ネットワーク非依存。
 *
 * カバー範囲:
 *   - 完全な OGP メタタグを含む HTML で全フィールドが抽出される
 *   - title のみの最小 HTML で他フィールドが空 / undefined
 *   - og:image がない場合は imageUrl が undefined
 *   - 不正 / 空 HTML でも throw せず空 RawOgp を返す
 *   - og:* が欠損している場合は twitter:* に fallback する
 */
import { describe, expect, it } from 'vitest'
import { extractOgp } from '../../../utils/ogp/extractOgp'

const BASE_URL = 'https://example.com/article'

function htmlWithHead(headInner: string): string {
  return `<!doctype html><html><head>${headInner}</head><body></body></html>`
}

describe('extractOgp', () => {
  it('extracts all fields from a fully-tagged HTML', async () => {
    const head = [
      '<meta property="og:title" content="Hello, world!">',
      '<meta property="og:description" content="A short description.">',
      '<meta property="og:url" content="https://example.com/canonical">',
      '<meta property="og:image" content="https://example.com/og.png">',
      '<meta property="og:site_name" content="Example">',
    ].join('')
    const result = await extractOgp(htmlWithHead(head), BASE_URL)

    expect(result.title).toBe('Hello, world!')
    expect(result.description).toBe('A short description.')
    expect(result.url).toBe('https://example.com/canonical')
    expect(result.imageUrl).toBe('https://example.com/og.png')
    expect(result.siteName).toBe('Example')
  })

  it('returns minimal fields when only og:title is present', async () => {
    const head = '<meta property="og:title" content="Only title">'
    const result = await extractOgp(htmlWithHead(head), BASE_URL)

    expect(result.title).toBe('Only title')
    expect(result.description).toBe('')
    // og:url 欠損時は baseUrl にフォールバック。
    expect(result.url).toBe(BASE_URL)
    expect(result.imageUrl).toBeUndefined()
    expect(result.siteName).toBeUndefined()
  })

  it('leaves imageUrl undefined when og:image is missing', async () => {
    const head = [
      '<meta property="og:title" content="No image">',
      '<meta property="og:url" content="https://example.com/">',
    ].join('')
    const result = await extractOgp(htmlWithHead(head), BASE_URL)

    expect(result.imageUrl).toBeUndefined()
  })

  it('returns empty RawOgp (url=baseUrl) when HTML is empty', async () => {
    const result = await extractOgp('', BASE_URL)

    // ogs は空 HTML で error を返すことがあるが、throw せず baseUrl fallback。
    expect(result.url).toBe(BASE_URL)
    expect(result.title ?? '').toBe('')
    expect(result.description ?? '').toBe('')
  })

  it('falls back to twitter: tags when og:* are absent', async () => {
    const head = [
      '<meta name="twitter:title" content="Twitter title">',
      '<meta name="twitter:description" content="Twitter desc">',
      '<meta name="twitter:image" content="https://example.com/twitter.png">',
    ].join('')
    const result = await extractOgp(htmlWithHead(head), BASE_URL)

    expect(result.title).toBe('Twitter title')
    expect(result.description).toBe('Twitter desc')
    expect(result.imageUrl).toBe('https://example.com/twitter.png')
  })

  it('prefers og:title over twitter:title when both exist', async () => {
    const head = [
      '<meta property="og:title" content="OG wins">',
      '<meta name="twitter:title" content="Twitter loses">',
    ].join('')
    const result = await extractOgp(htmlWithHead(head), BASE_URL)

    expect(result.title).toBe('OG wins')
  })
})
