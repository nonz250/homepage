import { describe, expect, it } from 'vitest'
import matter from 'gray-matter'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { articleFrontmatterSchema } from '../../../scripts/lib/schema/article'
import {
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_TOPIC_MAX_COUNT,
} from '../../../scripts/lib/constants'

/**
 * v4 スキーマは原典 (`site-articles/*.md`) の frontmatter を規定する。
 *
 * 検査項目:
 *   - コア: title / emoji / type / topics / published / published_at
 *   - 配信フラグ: site (default true) / zenn / qiita (default false)
 *   - slug: zennSlug (zenn:true 時必須) / qiitaSlug (qiita:true 時必須)
 *   - qiitaPayload: 任意 (qiita-cli の sync で書き戻される構造)
 *
 * fail-closed 原則に基づき、未知キーは reject、truthy 文字列 (`"true"`) も
 * reject。正常系テストは既存の記事 2 本の現行 frontmatter が parse 可能な
 * ことを保証する。
 */
describe('articleFrontmatterSchema', () => {
  /**
   * テスト中で頻出する「最低限 valid な frontmatter」。
   * title / type は必須、published / zenn / qiita などは default に依存しない。
   */
  const baseValid = {
    title: 'A valid title',
    type: 'tech' as const,
    topics: ['vue', 'nuxt-3'],
    published: true,
    published_at: '2026-04-17T12:00:00+09:00',
  }

  describe('required keys', () => {
    it('rejects when title is missing', () => {
      const { title: _title, ...rest } = baseValid
      void _title
      expect(articleFrontmatterSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects when type is missing', () => {
      const { type: _type, ...rest } = baseValid
      void _type
      expect(articleFrontmatterSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects when published is missing (no default)', () => {
      const { published: _published, ...rest } = baseValid
      void _published
      expect(articleFrontmatterSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects when published_at is missing', () => {
      const { published_at: _pub, ...rest } = baseValid
      void _pub
      expect(articleFrontmatterSchema.safeParse(rest).success).toBe(false)
    })
  })

  describe('strict mode: unknown keys', () => {
    it('rejects an unknown top-level key', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        unknownKey: 'whatever',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('strict boolean fields', () => {
    it('rejects a truthy string for `published`', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          published: 'true',
        }).success,
      ).toBe(false)
    })

    it('rejects a truthy string for `zenn`', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          zenn: 'true',
        }).success,
      ).toBe(false)
    })

    it('rejects a truthy string for `site`', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          site: 'true',
        }).success,
      ).toBe(false)
    })
  })

  describe('distribution flag defaults', () => {
    it('defaults site=true, zenn=false, qiita=false when omitted', () => {
      const parsed = articleFrontmatterSchema.parse({
        ...baseValid,
      })
      expect(parsed.site).toBe(true)
      expect(parsed.zenn).toBe(false)
      expect(parsed.qiita).toBe(false)
    })

    it('rejects if all of site/zenn/qiita are false (no sink)', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        site: false,
        zenn: false,
        qiita: false,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('slug requirements tied to distribution flags', () => {
    it('rejects zenn=true without zennSlug', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        zenn: true,
      })
      expect(result.success).toBe(false)
    })

    it('rejects qiita=true without qiitaSlug', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        qiita: true,
      })
      expect(result.success).toBe(false)
    })

    it('accepts zenn=true with a valid zennSlug', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        zenn: true,
        zennSlug: 'nonz250-ai-rotom',
      })
      expect(result.success).toBe(true)
    })

    it('rejects zenn=true with a too-short zennSlug', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        zenn: true,
        zennSlug: 'short',
      })
      expect(result.success).toBe(false)
    })

    it('accepts qiita=true with a qiitaSlug', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        qiita: true,
        qiitaSlug: 'my-qiita-slug',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('topic validation (inherited from frontend conventions)', () => {
    it('rejects uppercase topics', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          topics: ['Uppercase'],
        }).success,
      ).toBe(false)
    })

    it('rejects topic starting with hyphen', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          topics: ['-bad'],
        }).success,
      ).toBe(false)
    })

    it(`accepts topics up to ARTICLE_TOPIC_MAX_COUNT (${ARTICLE_TOPIC_MAX_COUNT})`, () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          topics: Array.from({ length: ARTICLE_TOPIC_MAX_COUNT }, (_, i) => `t${i}`),
        }).success,
      ).toBe(true)
    })

    it('rejects more than the max number of topics', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          topics: Array.from({ length: ARTICLE_TOPIC_MAX_COUNT + 1 }, (_, i) => `t${i}`),
        }).success,
      ).toBe(false)
    })
  })

  describe('title length', () => {
    it('accepts title at the exact max length', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          title: 'a'.repeat(ARTICLE_TITLE_MAX_LENGTH),
        }).success,
      ).toBe(true)
    })

    it('rejects a title exceeding the max length', () => {
      expect(
        articleFrontmatterSchema.safeParse({
          ...baseValid,
          title: 'a'.repeat(ARTICLE_TITLE_MAX_LENGTH + 1),
        }).success,
      ).toBe(false)
    })

    it('rejects an empty title', () => {
      expect(
        articleFrontmatterSchema.safeParse({ ...baseValid, title: '' }).success,
      ).toBe(false)
    })
  })

  describe('type enum', () => {
    it('accepts "tech"', () => {
      expect(
        articleFrontmatterSchema.safeParse({ ...baseValid, type: 'tech' }).success,
      ).toBe(true)
    })

    it('accepts "idea"', () => {
      expect(
        articleFrontmatterSchema.safeParse({ ...baseValid, type: 'idea' }).success,
      ).toBe(true)
    })

    it('rejects unknown types', () => {
      expect(
        articleFrontmatterSchema.safeParse({ ...baseValid, type: 'blog' })
          .success,
      ).toBe(false)
    })
  })

  describe('qiitaPayload (optional carrier for qiita-cli sync)', () => {
    it('accepts a full qiitaPayload block', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        qiita: true,
        qiitaSlug: 'my-qiita',
        qiitaPayload: {
          ignorePublish: false,
          private: false,
          id: 'abc123',
          organization_url_name: 'my-org',
          slide: false,
        },
      })
      expect(result.success).toBe(true)
    })

    it('accepts a partial qiitaPayload with unrelated keys missing', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        qiita: true,
        qiitaSlug: 'my-qiita',
        qiitaPayload: { private: true },
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown qiitaPayload keys (strict inside)', () => {
      const result = articleFrontmatterSchema.safeParse({
        ...baseValid,
        qiita: true,
        qiitaSlug: 'my-qiita',
        qiitaPayload: { unknownInside: 'x' },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('real fixtures from articles/ and site-articles/', () => {
    /**
     * 既存 articles/nonz250-ai-rotom.md の frontmatter が accept されること。
     * Zenn Connect フォーマットと後方互換を保つ目的で、site スキーマが
     * articles/ の現行形式を受け入れられなければ意味がないため明示テスト。
     */
    it('accepts the frontmatter of articles/nonz250-ai-rotom.md', () => {
      const filePath = resolve(
        __dirname,
        '../../../articles/nonz250-ai-rotom.md',
      )
      const raw = readFileSync(filePath, 'utf8')
      const parsed = matter(raw)
      const result = articleFrontmatterSchema.safeParse(parsed.data)
      expect(result.success).toBe(true)
    })

    /**
     * 既存 site-articles/2026-04-19-ai-rotom.md が accept されること。
     * こちらは v4 原典側の現行サンプルで、frontmatter は v4 正式形式に
     * 寄せた書き方になっている (ISO 8601 offset, published=false など)。
     */
    it('accepts the frontmatter of site-articles/2026-04-19-ai-rotom.md', () => {
      const filePath = resolve(
        __dirname,
        '../../../site-articles/2026-04-19-ai-rotom.md',
      )
      const raw = readFileSync(filePath, 'utf8')
      const parsed = matter(raw)
      const result = articleFrontmatterSchema.safeParse(parsed.data)
      expect(result.success).toBe(true)
    })
  })
})
