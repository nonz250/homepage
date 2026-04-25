import { describe, expect, it } from 'vitest'
import {
  buildPrerenderRoutes,
  PREVIEW_IN_PRODUCTION_ERROR_MESSAGE,
  type Article,
} from '../../../utils/prerender/buildPrerenderRoutes'

/**
 * `buildPrerenderRoutes` の単体テスト。
 *
 * 純関数として以下の仕様境界を検証する:
 *   - fail-closed: production × preview で throw
 *   - preview モード: 下書き・予約投稿も含めて全件
 *   - 本番モード: 公開済みかつ published_at <= buildTime のみ
 *   - published_at 未指定でも公開扱い
 *   - invalid な published_at で crash しない (除外される)
 *   - 空配列入力で空配列返却
 */
describe('buildPrerenderRoutes', () => {
  const BUILD_TIME = new Date('2026-04-17T00:00:00Z')

  const publishedPast: Article = {
    slug: 'welcome',
    published: true,
    published_at: '2026-04-01T00:00:00+09:00',
  }
  const publishedNoDate: Article = {
    slug: 'no-date',
    published: true,
  }
  const publishedFuture: Article = {
    slug: 'scheduled',
    published: true,
    published_at: '2099-01-01T00:00:00+09:00',
  }
  const draft: Article = {
    slug: 'draft',
    published: false,
  }
  const invalidDate: Article = {
    slug: 'invalid',
    published: true,
    published_at: 'not-a-date',
  }

  describe('fail-closed guard', () => {
    it('throws when nodeEnv is production and preview is true', () => {
      expect(() =>
        buildPrerenderRoutes([publishedPast], BUILD_TIME, {
          preview: true,
          nodeEnv: 'production',
        }),
      ).toThrowError(PREVIEW_IN_PRODUCTION_ERROR_MESSAGE)
    })

    it('does not throw when nodeEnv is development and preview is true', () => {
      expect(() =>
        buildPrerenderRoutes([publishedPast], BUILD_TIME, {
          preview: true,
          nodeEnv: 'development',
        }),
      ).not.toThrow()
    })

    it('does not throw when nodeEnv is production and preview is false', () => {
      expect(() =>
        buildPrerenderRoutes([publishedPast], BUILD_TIME, {
          preview: false,
          nodeEnv: 'production',
        }),
      ).not.toThrow()
    })

    it('does not throw when nodeEnv is undefined and preview is true', () => {
      expect(() =>
        buildPrerenderRoutes([publishedPast], BUILD_TIME, {
          preview: true,
          nodeEnv: undefined,
        }),
      ).not.toThrow()
    })
  })

  describe('preview mode (development + preview=true)', () => {
    it('includes drafts and scheduled articles', () => {
      const result = buildPrerenderRoutes(
        [publishedPast, publishedFuture, draft],
        BUILD_TIME,
        { preview: true, nodeEnv: 'development' },
      )
      expect(result).toEqual([
        '/articles/welcome',
        '/articles/scheduled',
        '/articles/draft',
      ])
    })
  })

  describe('production mode (nodeEnv=production + preview=false)', () => {
    it('includes only published articles with published_at <= buildTime', () => {
      const result = buildPrerenderRoutes(
        [publishedPast, publishedFuture, draft],
        BUILD_TIME,
        { preview: false, nodeEnv: 'production' },
      )
      expect(result).toEqual(['/articles/welcome'])
    })

    it('includes published articles without published_at', () => {
      const result = buildPrerenderRoutes([publishedNoDate], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual(['/articles/no-date'])
    })

    it('excludes drafts', () => {
      const result = buildPrerenderRoutes([draft], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual([])
    })

    it('excludes future-scheduled articles', () => {
      const result = buildPrerenderRoutes([publishedFuture], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual([])
    })

    it('does not crash on invalid published_at and excludes the entry', () => {
      const result = buildPrerenderRoutes([invalidDate], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual([])
    })

    it('includes scheduled articles when in preview mode', () => {
      const result = buildPrerenderRoutes([publishedFuture], BUILD_TIME, {
        preview: true,
        nodeEnv: 'development',
      })
      expect(result).toEqual(['/articles/scheduled'])
    })
  })

  describe('edge cases', () => {
    it('returns [] for an empty input in production mode', () => {
      const result = buildPrerenderRoutes([], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual([])
    })

    it('returns [] for an empty input in preview mode', () => {
      const result = buildPrerenderRoutes([], BUILD_TIME, {
        preview: true,
        nodeEnv: 'development',
      })
      expect(result).toEqual([])
    })

    it('treats published_at equal to buildTime as visible', () => {
      const boundary: Article = {
        slug: 'boundary',
        published: true,
        published_at: BUILD_TIME.toISOString(),
      }
      const result = buildPrerenderRoutes([boundary], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual(['/articles/boundary'])
    })

    it('preserves article order in the resulting routes', () => {
      const a: Article = { slug: 'a', published: true }
      const b: Article = { slug: 'b', published: true }
      const c: Article = { slug: 'c', published: true }
      const result = buildPrerenderRoutes([a, b, c], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual(['/articles/a', '/articles/b', '/articles/c'])
    })
  })

  /**
   * Issue #59 リグレッション: Zenn Legacy 形式 (`YYYY-MM-DD HH:mm`) は TZ
   * 情報を持たないため、CI の UTC 環境で `Date.parse` をそのまま使うと
   * 21:00 JST が 21:00 UTC として未来扱いされ、記事が prerender 対象から
   * 漏れて URL が 404 になる事故が発生した。`parsePublishedAtMs` 経由で
   * 必ず JST として解釈されることを絶対時刻で固定する。
   */
  describe('Zenn Legacy published_at (issue #59 regression)', () => {
    const ZENN_LEGACY_BUILD_TIME = new Date('2026-04-23T13:00:00Z')

    it('treats "YYYY-MM-DD HH:mm" as JST so a 21:00 JST article published before a 13:00 UTC build is visible', () => {
      // 2026-04-23 21:00 JST = 2026-04-23 12:00 UTC < 13:00 UTC build
      const article: Article = {
        slug: 'jst-zenn-legacy',
        published: true,
        published_at: '2026-04-23 21:00',
      }
      const result = buildPrerenderRoutes([article], ZENN_LEGACY_BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual(['/articles/jst-zenn-legacy'])
    })

    it('still excludes a future Zenn Legacy datetime once interpreted as JST', () => {
      // 2099-01-01 09:00 JST is in the far future regardless of TZ.
      const article: Article = {
        slug: 'future',
        published: true,
        published_at: '2099-01-01 09:00',
      }
      const result = buildPrerenderRoutes([article], ZENN_LEGACY_BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual([])
    })
  })
})
