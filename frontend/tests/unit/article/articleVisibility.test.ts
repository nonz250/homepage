import { describe, expect, it } from 'vitest'
import {
  isArticleVisibleNow,
  toArticle,
} from '../../../utils/article/articleVisibility'

/**
 * `isArticleVisibleNow` / `toArticle` の単体テスト。
 *
 * composable 側の実装 (useArticles / useArticle) で使う共通ロジックを
 * 切り出した純関数群。仕様境界をテストで固定する。
 */
describe('isArticleVisibleNow', () => {
  const NOW = Date.parse('2026-04-17T00:00:00Z')

  it('returns false when published is false', () => {
    expect(
      isArticleVisibleNow({ published: false, published_at: '2020-01-01T00:00:00Z' }, NOW),
    ).toBe(false)
  })

  it('returns false when published is undefined', () => {
    expect(isArticleVisibleNow({}, NOW)).toBe(false)
  })

  it('returns true when published is true and published_at is omitted', () => {
    expect(isArticleVisibleNow({ published: true }, NOW)).toBe(true)
  })

  it('returns true when published_at is an empty string', () => {
    expect(
      isArticleVisibleNow({ published: true, published_at: '' }, NOW),
    ).toBe(true)
  })

  it('returns true for a past published_at', () => {
    expect(
      isArticleVisibleNow(
        { published: true, published_at: '2026-04-01T00:00:00+09:00' },
        NOW,
      ),
    ).toBe(true)
  })

  it('returns false for a future published_at', () => {
    expect(
      isArticleVisibleNow(
        { published: true, published_at: '2099-01-01T00:00:00+09:00' },
        NOW,
      ),
    ).toBe(false)
  })

  it('returns true when published_at equals now', () => {
    expect(
      isArticleVisibleNow(
        { published: true, published_at: new Date(NOW).toISOString() },
        NOW,
      ),
    ).toBe(true)
  })

  it('returns false for an invalid published_at string', () => {
    expect(
      isArticleVisibleNow(
        { published: true, published_at: 'not-a-date' },
        NOW,
      ),
    ).toBe(false)
  })
})

describe('toArticle', () => {
  it('maps a minimal content record to an Article', () => {
    const result = toArticle({
      stem: 'welcome',
      path: '/welcome',
      title: 'hello',
      type: 'tech',
      topics: ['a'],
      published: true,
      published_at: '2026-04-01T00:00:00+09:00',
      emoji: '👋',
    })
    expect(result).toEqual({
      slug: 'welcome',
      path: '/welcome',
      title: 'hello',
      type: 'tech',
      topics: ['a'],
      published: true,
      published_at: '2026-04-01T00:00:00+09:00',
      emoji: '👋',
    })
  })

  it('falls back to a derived path when path is missing', () => {
    const result = toArticle({
      stem: 'fallback',
      title: 't',
      type: 'idea',
      topics: [],
      published: false,
    })
    expect(result.path).toBe('/fallback')
  })

  it('coerces topics to [] when not an array', () => {
    const result = toArticle({
      stem: 's',
      path: '/s',
      title: 't',
      type: 'tech',
      topics: 'not-an-array' as unknown as string[],
      published: true,
    })
    expect(result.topics).toEqual([])
  })

  it('leaves emoji undefined when not provided', () => {
    const result = toArticle({
      stem: 's',
      path: '/s',
      title: 't',
      type: 'tech',
      topics: [],
      published: true,
    })
    expect(result.emoji).toBeUndefined()
  })

  it('coerces published to a strict boolean', () => {
    const result = toArticle({
      stem: 's',
      path: '/s',
      title: 't',
      type: 'tech',
      topics: [],
      published: 1 as unknown as boolean,
    })
    expect(result.published).toBe(false)
  })

  it('leaves published_at undefined when not a string', () => {
    const result = toArticle({
      stem: 's',
      path: '/s',
      title: 't',
      type: 'tech',
      topics: [],
      published: true,
      published_at: 12345 as unknown as string,
    })
    expect(result.published_at).toBeUndefined()
  })
})
