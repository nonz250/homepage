import { describe, expect, it } from 'vitest'
import {
  buildTagsIndex,
  type TagIndexArticle,
} from '../../../utils/prerender/buildTagsIndex'
import { PREVIEW_IN_PRODUCTION_ERROR_MESSAGE } from '../../../utils/prerender/buildPrerenderRoutes'

/**
 * `buildTagsIndex` の単体テスト。
 *
 * 純関数として以下の仕様境界を検証する:
 *   - 空配列入力 → 空オブジェクト
 *   - 1 記事 × 複数 topics でマップ化される
 *   - 複数記事で同じ topic を共有 → slug 配列が複数要素
 *   - 下書き記事は preview=false で除外 / preview=true で含まれる
 *   - 未来の published_at は preview=false で除外
 *   - invalid な published_at で crash せず除外
 *   - production × preview=true で throw (fail-closed)
 *   - 1 記事内で同一 topic の重複があっても slug は 1 回だけ
 *   - topics が空配列の記事は index に現れない
 *   - 記事列の並び順に合わせて slug 配列がビルドされる
 */
describe('buildTagsIndex', () => {
  const BUILD_TIME = new Date('2026-04-17T00:00:00Z')

  const publishedPast: TagIndexArticle = {
    slug: 'welcome',
    topics: ['blog', 'announcement'],
    published: true,
    published_at: '2026-04-01T00:00:00+09:00',
  }
  const publishedNoDate: TagIndexArticle = {
    slug: 'no-date',
    topics: ['blog'],
    published: true,
  }
  const publishedFuture: TagIndexArticle = {
    slug: 'scheduled',
    topics: ['blog', 'scheduled-tag'],
    published: true,
    published_at: '2099-01-01T00:00:00+09:00',
  }
  const draft: TagIndexArticle = {
    slug: 'draft',
    topics: ['draft-tag'],
    published: false,
  }
  const invalidDate: TagIndexArticle = {
    slug: 'invalid',
    topics: ['invalid-tag'],
    published: true,
    published_at: 'not-a-date',
  }

  describe('fail-closed guard', () => {
    it('throws when nodeEnv is production and preview is true', () => {
      expect(() =>
        buildTagsIndex([publishedPast], BUILD_TIME, {
          preview: true,
          nodeEnv: 'production',
        }),
      ).toThrowError(PREVIEW_IN_PRODUCTION_ERROR_MESSAGE)
    })

    it('does not throw when nodeEnv is development and preview is true', () => {
      expect(() =>
        buildTagsIndex([publishedPast], BUILD_TIME, {
          preview: true,
          nodeEnv: 'development',
        }),
      ).not.toThrow()
    })

    it('does not throw when nodeEnv is production and preview is false', () => {
      expect(() =>
        buildTagsIndex([publishedPast], BUILD_TIME, {
          preview: false,
          nodeEnv: 'production',
        }),
      ).not.toThrow()
    })

    it('does not throw when nodeEnv is undefined and preview is true', () => {
      expect(() =>
        buildTagsIndex([publishedPast], BUILD_TIME, {
          preview: true,
          nodeEnv: undefined,
        }),
      ).not.toThrow()
    })
  })

  describe('empty inputs', () => {
    it('returns {} for empty articles in production mode', () => {
      expect(
        buildTagsIndex([], BUILD_TIME, {
          preview: false,
          nodeEnv: 'production',
        }),
      ).toEqual({})
    })

    it('returns {} for empty articles in preview mode', () => {
      expect(
        buildTagsIndex([], BUILD_TIME, {
          preview: true,
          nodeEnv: 'development',
        }),
      ).toEqual({})
    })

    it('returns {} when every article has no topics', () => {
      const article: TagIndexArticle = {
        slug: 'empty-topics',
        topics: [],
        published: true,
      }
      expect(
        buildTagsIndex([article], BUILD_TIME, {
          preview: false,
          nodeEnv: 'production',
        }),
      ).toEqual({})
    })
  })

  describe('production mode (preview=false)', () => {
    it('expands topics of a single article into the index', () => {
      expect(
        buildTagsIndex([publishedPast], BUILD_TIME, {
          preview: false,
          nodeEnv: 'production',
        }),
      ).toEqual({
        blog: ['welcome'],
        announcement: ['welcome'],
      })
    })

    it('collects multiple slugs under the same topic', () => {
      const result = buildTagsIndex(
        [publishedPast, publishedNoDate],
        BUILD_TIME,
        { preview: false, nodeEnv: 'production' },
      )
      expect(result).toEqual({
        blog: ['welcome', 'no-date'],
        announcement: ['welcome'],
      })
    })

    it('excludes drafts from the index', () => {
      const result = buildTagsIndex([publishedPast, draft], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).not.toHaveProperty('draft-tag')
      expect(result).toEqual({
        blog: ['welcome'],
        announcement: ['welcome'],
      })
    })

    it('excludes scheduled-future articles from the index', () => {
      const result = buildTagsIndex(
        [publishedPast, publishedFuture],
        BUILD_TIME,
        { preview: false, nodeEnv: 'production' },
      )
      expect(result).not.toHaveProperty('scheduled-tag')
      expect(result).toEqual({
        blog: ['welcome'],
        announcement: ['welcome'],
      })
    })

    it('excludes articles with invalid published_at and does not throw', () => {
      const result = buildTagsIndex([publishedPast, invalidDate], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).not.toHaveProperty('invalid-tag')
    })

    it('includes a published article without published_at', () => {
      const result = buildTagsIndex([publishedNoDate], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual({ blog: ['no-date'] })
    })
  })

  describe('preview mode', () => {
    it('includes drafts under their topics', () => {
      const result = buildTagsIndex([publishedPast, draft], BUILD_TIME, {
        preview: true,
        nodeEnv: 'development',
      })
      expect(result).toEqual({
        blog: ['welcome'],
        announcement: ['welcome'],
        'draft-tag': ['draft'],
      })
    })

    it('includes future-scheduled articles under their topics', () => {
      const result = buildTagsIndex(
        [publishedPast, publishedFuture],
        BUILD_TIME,
        { preview: true, nodeEnv: 'development' },
      )
      expect(result).toEqual({
        blog: ['welcome', 'scheduled'],
        announcement: ['welcome'],
        'scheduled-tag': ['scheduled'],
      })
    })
  })

  describe('edge cases', () => {
    it('deduplicates repeated topics within the same article', () => {
      const article: TagIndexArticle = {
        slug: 'dup-topics',
        topics: ['blog', 'blog', 'note'],
        published: true,
      }
      const result = buildTagsIndex([article], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual({
        blog: ['dup-topics'],
        note: ['dup-topics'],
      })
    })

    it('preserves article insertion order within each topic bucket', () => {
      const a: TagIndexArticle = {
        slug: 'a',
        topics: ['t'],
        published: true,
      }
      const b: TagIndexArticle = {
        slug: 'b',
        topics: ['t'],
        published: true,
      }
      const c: TagIndexArticle = {
        slug: 'c',
        topics: ['t'],
        published: true,
      }
      const result = buildTagsIndex([a, b, c], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual({ t: ['a', 'b', 'c'] })
    })

    it('treats published_at equal to buildTime as visible', () => {
      const boundary: TagIndexArticle = {
        slug: 'boundary',
        topics: ['boundary-tag'],
        published: true,
        published_at: BUILD_TIME.toISOString(),
      }
      const result = buildTagsIndex([boundary], BUILD_TIME, {
        preview: false,
        nodeEnv: 'production',
      })
      expect(result).toEqual({ 'boundary-tag': ['boundary'] })
    })
  })
})
