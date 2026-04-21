/**
 * `utils/ogp/buildOgpInputs.ts` のユニットテスト。
 *
 * カバー範囲:
 *   - 公開済みの記事のみ対象にする
 *   - preview=true のときは下書きも含まれる
 *   - production + preview=true は throw (buildPrerenderRoutes 由来)
 *   - 長いタイトルは切り詰められる
 *   - tags は上限 5 件
 *   - published_at が ISO なら YYYY-MM-DD に整形される
 */
import { describe, expect, it } from 'vitest'
import {
  buildOgpInputs,
  type OgpSourceArticle,
} from '../../../utils/ogp/buildOgpInputs'
import { PREVIEW_IN_PRODUCTION_ERROR_MESSAGE } from '../../../utils/prerender/buildPrerenderRoutes'

const BUILD_TIME = new Date('2026-04-18T23:59:59Z')

function article(overrides: Partial<OgpSourceArticle>): OgpSourceArticle {
  return {
    slug: overrides.slug ?? 'hello',
    title: overrides.title ?? 'Hello',
    published: overrides.published ?? true,
    published_at: overrides.published_at,
    topics: overrides.topics ?? [],
    emoji: overrides.emoji,
    // v4: `site` は `LoadedArticle` 側で required。fixture はサイト配信扱いで固定。
    site: overrides.site ?? true,
  }
}

describe('buildOgpInputs', () => {
  it('includes only published articles when preview=false', () => {
    const entries = buildOgpInputs(
      [
        article({ slug: 'a', title: 'A', published: true }),
        article({ slug: 'b', title: 'B', published: false }),
      ],
      { preview: false, nodeEnv: 'production', buildTime: BUILD_TIME },
    )
    expect(entries.map((e) => e.slug)).toEqual(['a'])
  })

  it('includes drafts when preview=true (non-production)', () => {
    const entries = buildOgpInputs(
      [
        article({ slug: 'a', title: 'A', published: true }),
        article({ slug: 'b', title: 'B', published: false }),
      ],
      { preview: true, nodeEnv: 'development', buildTime: BUILD_TIME },
    )
    expect(entries.map((e) => e.slug).sort()).toEqual(['a', 'b'])
  })

  it('throws in production when preview=true', () => {
    expect(() =>
      buildOgpInputs([], {
        preview: true,
        nodeEnv: 'production',
        buildTime: BUILD_TIME,
      }),
    ).toThrowError(PREVIEW_IN_PRODUCTION_ERROR_MESSAGE)
  })

  it('truncates long titles', () => {
    const longTitle = 'あ'.repeat(500)
    const entries = buildOgpInputs(
      [article({ slug: 'a', title: longTitle, published: true })],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    // 120 codepoints まで
    expect(Array.from(entries[0].input.title).length).toBe(120)
  })

  it('caps tags to at most 5 items', () => {
    const entries = buildOgpInputs(
      [
        article({
          slug: 'a',
          title: 'A',
          published: true,
          topics: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'],
        }),
      ],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    expect(entries[0].input.tags.length).toBe(5)
  })

  it('formats published_at as YYYY-MM-DD (UTC)', () => {
    const entries = buildOgpInputs(
      [
        article({
          slug: 'a',
          title: 'A',
          published: true,
          published_at: '2026-04-18T03:00:00Z',
        }),
      ],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    expect(entries[0].input.date).toBe('2026-04-18')
  })

  it('emits empty date when published_at is missing', () => {
    const entries = buildOgpInputs(
      [article({ slug: 'a', title: 'A', published: true })],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    expect(entries[0].input.date).toBe('')
  })

  it('excludes entries whose published_at fails to parse', () => {
    // published_at が parse 不能なら buildPrerenderRoutes 側で除外されるため
    // OGP inputs 配列にも含まれない。
    const entries = buildOgpInputs(
      [
        article({
          slug: 'b',
          title: 'B',
          published: true,
          published_at: 'not-a-date',
        }),
      ],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    expect(entries).toEqual([])
  })

  it('falls back to slug when title is empty', () => {
    const entries = buildOgpInputs(
      [article({ slug: 'my-slug', title: '', published: true })],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    expect(entries[0].input.title).toBe('my-slug')
  })

  it('passes emoji through when present', () => {
    const entries = buildOgpInputs(
      [article({ slug: 'a', title: 'A', published: true, emoji: '🧪' })],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    expect(entries[0].input.emoji).toBe('🧪')
  })

  it('omits emoji when source has none', () => {
    const entries = buildOgpInputs(
      [article({ slug: 'a', title: 'A', published: true })],
      { preview: false, nodeEnv: undefined, buildTime: BUILD_TIME },
    )
    expect(entries[0].input.emoji).toBeUndefined()
  })
})
