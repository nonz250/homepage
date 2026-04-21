import { z } from 'zod'
import {
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_TITLE_MIN_LENGTH,
  ARTICLE_TOPIC_MAX_COUNT,
  ARTICLE_TOPIC_PATTERN,
  ZENN_SLUG_PATTERN,
} from '../constants'
import { publishedAtSchema } from './publishedAt'

/**
 * `type` フィールドで許容する値。Zenn 互換: `tech` または `idea`。
 */
const articleTypeSchema = z.enum(['tech', 'idea'])

/**
 * `topics` フィールドで許容する配列。frontend/constants/article.ts の
 * `ARTICLE_TOPIC_PATTERN` / `ARTICLE_TOPIC_MAX_COUNT` と揃える。
 */
const articleTopicsSchema = z
  .array(z.string().regex(ARTICLE_TOPIC_PATTERN))
  .max(ARTICLE_TOPIC_MAX_COUNT)
  .default([])

/**
 * Qiita 側 slug の形式。Qiita は 20 文字固定の英数字 ID を慣習的に使うが、
 * ユーザー入力として任意の slug を許容するため、Zenn より緩い制約とする。
 *
 * 最低限 "空文字でないこと + ASCII safe" を保証する。詳細な許容集合は
 * Qiita 側の記事作成 API 仕様に追随して今後調整する予定。
 */
const qiitaSlugSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/)

/**
 * `qiita-cli` の sync が書き戻す可能性のある補助 frontmatter。
 *
 * 本プロジェクトの「原典 = site-articles/*.md」の思想に沿うと、このブロックが
 * 必須になることはない。しかし qiita-cli はローカル編集時に以下のキーを
 * 自動で追加するため、原典側がそれらを許容できないとラウンドトリップ時に
 * 衝突する。
 *
 * 既知のキー: ignorePublish / private / id / organization_url_name / slide
 * それ以外のキーは fail-closed で reject する (`.strict()`)。
 */
const qiitaPayloadSchema = z
  .object({
    ignorePublish: z.boolean().optional(),
    private: z.boolean().optional(),
    id: z.string().optional(),
    organization_url_name: z.string().optional(),
    slide: z.boolean().optional(),
  })
  .strict()
  .optional()

/**
 * 記事 frontmatter の v4 スキーマ (site-articles/*.md の原典を規定する).
 *
 * 構造:
 *   - コア: title / emoji / type / topics / published / published_at
 *   - 配信フラグ: site (default true) / zenn (default false) / qiita (default false)
 *   - slug: zennSlug / qiitaSlug (フラグと紐づく .refine で必須判定)
 *   - qiitaPayload: qiita-cli が sync で差し込む補助 frontmatter
 *
 * 方針:
 *   - `.strict()` で未知キーを reject (fail-closed)
 *   - `z.boolean()` で真偽値のみ受理 (`"true"` / `"false"` のような文字列は reject)
 *   - `.refine()` で "zenn:true なら zennSlug 必須" 等の条件を検査
 *   - パース後も入力文字列を保持する必要があるフィールド (published_at) は
 *     `publishedAtSchema` に委譲し、byte 一致を維持する
 */
export const articleFrontmatterSchema = z
  .object({
    title: z
      .string()
      .min(ARTICLE_TITLE_MIN_LENGTH)
      .max(ARTICLE_TITLE_MAX_LENGTH),
    emoji: z.string().optional(),
    type: articleTypeSchema,
    topics: articleTopicsSchema,
    published: z.boolean(),
    published_at: publishedAtSchema,
    site: z.boolean().default(true),
    zenn: z.boolean().default(false),
    qiita: z.boolean().default(false),
    zennSlug: z.string().regex(ZENN_SLUG_PATTERN).optional(),
    qiitaSlug: qiitaSlugSchema.optional(),
    qiitaPayload: qiitaPayloadSchema,
  })
  .strict()
  .refine(
    (value) => value.site === true || value.zenn === true || value.qiita === true,
    {
      message:
        'site / zenn / qiita のいずれかは true である必要があります (配信先のない記事は定義できません)',
      path: ['site'],
    },
  )
  .refine(
    (value) => value.zenn === false || typeof value.zennSlug === 'string',
    {
      message: 'zenn: true のときは zennSlug を指定してください',
      path: ['zennSlug'],
    },
  )
  .refine(
    (value) => value.qiita === false || typeof value.qiitaSlug === 'string',
    {
      message: 'qiita: true のときは qiitaSlug を指定してください',
      path: ['qiitaSlug'],
    },
  )

/** パース後の frontmatter 型 */
export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>
