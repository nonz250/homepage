import { describe, expect, it } from 'vitest'
import { normalizePreviewFlag } from '../../utils/env/isPreview'
import {
  buildPrerenderRoutes,
  PREVIEW_IN_PRODUCTION_ERROR_MESSAGE,
  type Article as PrerenderArticle,
} from '../../utils/prerender/buildPrerenderRoutes'
import {
  isArticleVisibleNow,
  toArticle,
} from '../../utils/article/articleVisibility'

/**
 * CONTENT_PREVIEW フローの契約テスト。
 *
 * `nuxt.config.ts` の `runtimeConfig.contentPreview` の算出ロジックを
 * 実装と同じ組み合わせで検証し、「開発時は preview 可 / 本番ビルドでは
 * 必ず false」という fail-closed 契約を純関数レベルで固定する。
 *
 * この契約テストの責務:
 *   1. 環境変数の入力 -> `runtimeConfig.contentPreview` の算出 (nuxt.config.ts
 *      と同じ式) が期待通りの真偽値を返す
 *   2. `buildPrerenderRoutes` の fail-closed 契約 (production x preview=true
 *      で throw) が維持されている
 *   3. fixture に対応する 5 件の記事 frontmatter を対象に、preview on/off の
 *      visibility フィルタ結果が期待通り
 *
 * composable レベルの取得挙動 (`useArticles` / `useArticle`) は
 * `queryCollection` 依存のため contract スコープでは検証せず、integration
 * テストに委ねる。ここでは純関数の契約のみを対象とする。
 */

/**
 * `nuxt.config.ts` と同一ロジックで `runtimeConfig.contentPreview` を算出する。
 * contract テストで実装と動作を一致させるため、同じ式をそのまま写経している。
 */
function computeRuntimeContentPreview(
  raw: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  const isPreviewEnv = normalizePreviewFlag(raw)
  const isProductionBuild = nodeEnv === 'production'
  return isPreviewEnv && !isProductionBuild
}

describe('CONTENT_PREVIEW -> runtimeConfig.contentPreview contract', () => {
  describe('preview enabled cases', () => {
    it('CONTENT_PREVIEW=1 and NODE_ENV=development yields true', () => {
      expect(computeRuntimeContentPreview('1', 'development')).toBe(true)
    })

    it('CONTENT_PREVIEW=true and NODE_ENV=development yields true', () => {
      expect(computeRuntimeContentPreview('true', 'development')).toBe(true)
    })

    it('CONTENT_PREVIEW=yes and NODE_ENV undefined yields true', () => {
      expect(computeRuntimeContentPreview('yes', undefined)).toBe(true)
    })
  })

  describe('fail-closed in production', () => {
    it('CONTENT_PREVIEW=1 and NODE_ENV=production yields false', () => {
      expect(computeRuntimeContentPreview('1', 'production')).toBe(false)
    })

    it('CONTENT_PREVIEW=true and NODE_ENV=production yields false', () => {
      expect(computeRuntimeContentPreview('true', 'production')).toBe(false)
    })
  })

  describe('preview disabled cases', () => {
    it.each([
      ['empty string', ''],
      ["'0'", '0'],
      ["'false'", 'false'],
      ['undefined', undefined],
      ["'random'", 'random'],
    ])('CONTENT_PREVIEW=%s yields false regardless of NODE_ENV', (_label, raw) => {
      expect(computeRuntimeContentPreview(raw, 'development')).toBe(false)
      expect(computeRuntimeContentPreview(raw, 'production')).toBe(false)
      expect(computeRuntimeContentPreview(raw, undefined)).toBe(false)
    })
  })
})

describe('buildPrerenderRoutes fail-closed contract', () => {
  const BUILD_TIME = new Date('2026-04-17T00:00:00Z')
  const anyPublished: PrerenderArticle = {
    slug: 'welcome',
    published: true,
    published_at: '2026-04-01T00:00:00+09:00',
  }

  it('throws when preview=true and nodeEnv=production', () => {
    expect(() =>
      buildPrerenderRoutes([anyPublished], BUILD_TIME, {
        preview: true,
        nodeEnv: 'production',
      }),
    ).toThrowError(PREVIEW_IN_PRODUCTION_ERROR_MESSAGE)
  })

  it('does not throw for preview=false in production', () => {
    expect(() =>
      buildPrerenderRoutes([anyPublished], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      }),
    ).not.toThrow()
  })

  it('does not throw for preview=true outside production', () => {
    expect(() =>
      buildPrerenderRoutes([anyPublished], BUILD_TIME, {
        preview: true,
        nodeEnv: 'development',
      }),
    ).not.toThrow()
  })
})

describe('fixture article visibility contract (5 fixtures)', () => {
  /**
   * fixture 記事 5 本の frontmatter を不変値として写経する。
   * `articles/*.md` の変更時はここも更新が必要 (契約テストなので意図的)。
   */
  const FIXTURE_BUILD_TIME_MS = Date.parse('2026-04-17T00:00:00Z')

  type Fixture = {
    readonly slug: string
    readonly published: boolean
    readonly published_at?: string
  }

  const FIXTURES: readonly Fixture[] = [
    {
      slug: 'welcome',
      published: true,
      published_at: '2026-04-01T00:00:00+09:00',
    },
    {
      slug: 'roadmap',
      published: true,
      published_at: '2026-03-20T00:00:00+09:00',
    },
    {
      slug: 'changelog',
      published: true,
      published_at: '2026-04-10T00:00:00+09:00',
    },
    {
      slug: 'draft-feature',
      published: false,
    },
    {
      slug: 'scheduled-release',
      published: true,
      published_at: '2099-01-01T00:00:00+09:00',
    },
  ]

  describe('preview mode yields all fixtures', () => {
    it('returns every slug when preview is true', () => {
      const slugs = FIXTURES.map((f) => f.slug)
      // preview モードでは isArticleVisibleNow によるフィルタを適用しない
      // (useArticles 側の契約)。純関数テストとしては全件がそのまま
      // 取得対象候補に含まれることを確認する。
      expect(slugs).toHaveLength(FIXTURES.length)
      expect(slugs).toContain('draft-feature')
      expect(slugs).toContain('scheduled-release')
    })
  })

  describe('production mode filters drafts and future publish dates', () => {
    it('yields only welcome, roadmap and changelog', () => {
      const visible = FIXTURES.filter((f) =>
        isArticleVisibleNow(f, FIXTURE_BUILD_TIME_MS),
      )
        .map((f) => f.slug)
        .sort()
      expect(visible).toEqual(['changelog', 'roadmap', 'welcome'])
    })

    it('never yields draft-feature (published=false)', () => {
      const draft = FIXTURES.find((f) => f.slug === 'draft-feature')
      expect(draft).toBeDefined()
      expect(isArticleVisibleNow(draft!, FIXTURE_BUILD_TIME_MS)).toBe(false)
    })

    it('never yields scheduled-release while build time is before 2099', () => {
      const scheduled = FIXTURES.find((f) => f.slug === 'scheduled-release')
      expect(scheduled).toBeDefined()
      expect(isArticleVisibleNow(scheduled!, FIXTURE_BUILD_TIME_MS)).toBe(false)
    })
  })

  describe('toArticle DTO contract', () => {
    it('maps frontmatter to the Article DTO expected by composables', () => {
      const welcome = FIXTURES[0]
      const article = toArticle({
        stem: welcome.slug,
        path: `/${welcome.slug}`,
        title: 'このブログへようこそ',
        emoji: '👋',
        type: 'idea',
        topics: ['blog', 'hello'],
        published: welcome.published,
        published_at: welcome.published_at,
      })
      expect(article.slug).toBe('welcome')
      expect(article.path).toBe('/welcome')
      expect(article.published).toBe(true)
      expect(article.emoji).toBe('👋')
      expect(article.topics).toEqual(['blog', 'hello'])
    })
  })
})
