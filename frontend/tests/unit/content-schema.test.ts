import { describe, expect, it } from 'vitest'
import { articleFrontmatterSchema } from '../../content/schema/article'
import {
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_TOPIC_MAX_COUNT,
} from '../../constants/article'

/**
 * 記事 frontmatter スキーマの単体テスト。
 *
 * content.config.ts で利用される schema と同一のものを import してテストする。
 * OK ケース / NG ケースの境界を明示的に検証する。
 */
describe('articleFrontmatterSchema', () => {
  const baseValid = {
    title: 'A valid title',
    type: 'tech' as const,
    topics: ['vue', 'nuxt-3'],
    published: true,
    published_at: '2026-04-17T12:00:00+09:00',
  }

  describe('valid cases', () => {
    it('accepts a minimal valid frontmatter', () => {
      const result = articleFrontmatterSchema.safeParse({
        title: 'hello',
        type: 'tech',
      })
      expect(result.success).toBe(true)
    })

    it('applies default [] to topics when omitted', () => {
      const result = articleFrontmatterSchema.parse({
        title: 'hello',
        type: 'idea',
      })
      expect(result.topics).toEqual([])
      expect(result.published).toBe(false)
    })

    it('accepts emoji when provided', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        emoji: '🚀',
      })
      expect(result.success).toBe(true)
    })

    it('accepts title at the exact max length', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        title: 'a'.repeat(ARTICLE_TITLE_MAX_LENGTH),
      })
      expect(result.success).toBe(true)
    })

    it('accepts topics at the exact max count', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        topics: Array.from(
          { length: ARTICLE_TOPIC_MAX_COUNT },
          (_, i) => `t${i}`,
        ),
      })
      expect(result.success).toBe(true)
    })

    it('accepts both tech and idea for type', () => {
      expect(
        articleFrontmatterSchema.safeParse({ ...baseValid, type: 'tech' }).success,
      ).toBe(true)
      expect(
        articleFrontmatterSchema.safeParse({ ...baseValid, type: 'idea' }).success,
      ).toBe(true)
    })

    it('defaults site to true when the field is omitted', () => {
      const result = articleFrontmatterSchema.parse({
        title: 'hello',
        type: 'tech',
      })
      expect(result.site).toBe(true)
    })

    it('accepts site as an explicit boolean', () => {
      const resultTrue = articleFrontmatterSchema.parse({
        ...baseValid,
        site: true,
      })
      const resultFalse = articleFrontmatterSchema.parse({
        ...baseValid,
        site: false,
      })
      expect(resultTrue.site).toBe(true)
      expect(resultFalse.site).toBe(false)
    })

    it('accepts optional zenn and qiita flags', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        zenn: true,
        qiita: false,
      })
      expect(result.success).toBe(true)
    })

    it('accepts optional zennSlug and qiitaSlug strings', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        zenn: true,
        zennSlug: 'my-article',
        qiita: false,
        qiitaSlug: 'abcdef0123',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty title', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        title: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects a title exceeding the max length', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        title: 'a'.repeat(ARTICLE_TITLE_MAX_LENGTH + 1),
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than the max number of topics', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        topics: Array.from(
          { length: ARTICLE_TOPIC_MAX_COUNT + 1 },
          (_, i) => `t${i}`,
        ),
      })
      expect(result.success).toBe(false)
    })

    it('rejects a topic that starts with a hyphen', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        topics: ['-invalid'],
      })
      expect(result.success).toBe(false)
    })

    it('rejects a topic that contains uppercase letters', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        topics: ['Uppercase'],
      })
      expect(result.success).toBe(false)
    })

    it('rejects a published_at that is not ISO8601 with offset', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        published_at: '2026-04-17',
      })
      expect(result.success).toBe(false)
    })

    it('rejects when required title is missing', () => {
      const { title, ...rest } = baseValid
      void title
      const result = articleFrontmatterSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects when required type is missing', () => {
      const { type, ...rest } = baseValid
      void type
      const result = articleFrontmatterSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects an unknown type value', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        type: 'blog',
      })
      expect(result.success).toBe(false)
    })
  })
})
