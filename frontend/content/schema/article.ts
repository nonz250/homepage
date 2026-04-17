import { z } from '@nuxt/content'
import {
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_TITLE_MIN_LENGTH,
  ARTICLE_TOPIC_MAX_COUNT,
  ARTICLE_TOPIC_PATTERN,
} from '../../constants/article'

/**
 * 記事 frontmatter のバリデーションスキーマ。
 *
 * content.config.ts と単体テストの双方から import して利用する。
 * @nuxt/content v3 は zod ベースで schema を要求するため、同梱の `z` を
 * 再利用している。
 */
export const articleFrontmatterSchema = z.object({
  title: z
    .string()
    .min(ARTICLE_TITLE_MIN_LENGTH)
    .max(ARTICLE_TITLE_MAX_LENGTH),
  emoji: z.string().optional(),
  type: z.enum(['tech', 'idea']),
  topics: z
    .array(z.string().regex(ARTICLE_TOPIC_PATTERN))
    .max(ARTICLE_TOPIC_MAX_COUNT)
    .default([]),
  published: z.boolean().default(false),
  published_at: z.string().datetime({ offset: true }).optional(),
})

/** 記事 frontmatter の型 (parse 後) */
export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>
