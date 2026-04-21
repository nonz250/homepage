import { describe, expect, it } from 'vitest'
import { toZennFrontmatter } from '../../../scripts/lib/frontmatter/toZennFrontmatter'
import type { ArticleFrontmatter } from '../../../scripts/lib/schema/article'

describe('toZennFrontmatter', () => {
  const base: ArticleFrontmatter = {
    title: 'hello',
    emoji: '🤖',
    type: 'tech',
    topics: ['ai', 'mcp'],
    published: true,
    published_at: '2026-04-19 21:00',
    site: true,
    zenn: true,
    qiita: false,
    zennSlug: 'nonz250-ai-rotom',
  }

  it('strips source-only fields and keeps core keys', () => {
    const result = toZennFrontmatter(base)
    expect(result).toEqual({
      title: 'hello',
      emoji: '🤖',
      type: 'tech',
      topics: ['ai', 'mcp'],
      published: true,
      published_at: '2026-04-19 21:00',
    })
  })

  it('preserves the original published_at string byte-for-byte', () => {
    for (const publishedAt of [
      '2026-04-19 21:00',
      '2026-04-19T21:00:00+09:00',
      '2026-04-19T12:00:00Z',
    ]) {
      const result = toZennFrontmatter({ ...base, published_at: publishedAt })
      expect(result.published_at).toBe(publishedAt)
    }
  })

  it('omits emoji when absent in the source', () => {
    const { emoji: _e, ...rest } = base
    void _e
    const result = toZennFrontmatter(rest as ArticleFrontmatter)
    expect(result.emoji).toBeUndefined()
  })

  it('does not carry over zennSlug / qiita / site / qiitaPayload', () => {
    const result = toZennFrontmatter({
      ...base,
      qiitaSlug: 'qiita-slug',
      qiitaPayload: { ignorePublish: true, private: false },
    })
    // in で確認することで optional 型が未定義でも object 側に key 自体が
    // 残っていないことを検証する。
    expect('zennSlug' in result).toBe(false)
    expect('qiitaSlug' in result).toBe(false)
    expect('site' in result).toBe(false)
    expect('zenn' in result).toBe(false)
    expect('qiita' in result).toBe(false)
    expect('qiitaPayload' in result).toBe(false)
  })
})
