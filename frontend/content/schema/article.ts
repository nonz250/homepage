import { z } from 'zod'
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
 * @nuxt/content v3 は内部で zod を利用するため、ここでも同じ zod を直接
 * 参照する (`z.infer` のような type-level namespace を使うには zod を値
 * だけでなく型空間でも公開している必要があり、`@nuxt/content` の再 export
 * された `z` は value のみで namespace を形成しないため)。
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
