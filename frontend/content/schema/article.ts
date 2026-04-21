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
 *
 * 注意: 原典スキーマは `scripts/lib/schema/article.ts` (Node CJS/ESM 境界で
 * 走る generator 用) に存在する。Nuxt alias や @nuxt/content の import 経路の
 * 都合でモジュールを共有しづらいため、本ファイルはフロントエンド側が
 * 最低限必要とするフィールドだけを複製する。原典を変更した際はこの
 * ファイルも手動で同期すること (特に `site` フラグの default 値)。
 */
export const articleFrontmatterSchema = z
  .object({
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
    /**
     * 本サイト ([nozomi.bike](https://nozomi.bike)) 上に公開するか。
     * v4 で導入した配信フラグの 1 つで、未指定時は true (= 旧挙動と同じく
     * サイト側に出す) として扱う。`site: false` の記事は UI フィルタで一覧から
     * 除外される (`useArticles` / `feed.xml`)。
     */
    site: z.boolean().default(true),
    /**
     * Zenn に配信するか。サイト側では値のみ受け取り UI フィルタには使わない。
     * scripts 側 schema と合わせて `.default(false)` に揃える (fail-closed)。
     */
    zenn: z.boolean().default(false),
    /**
     * Qiita に配信するか。サイト側では値のみ受け取り UI フィルタには使わない。
     * scripts 側 schema と合わせて `.default(false)` に揃える (fail-closed)。
     */
    qiita: z.boolean().default(false),
    /** Zenn 用 slug。generator 側で Zenn 記事ファイル名として利用 */
    zennSlug: z.string().optional(),
    /** Qiita 用 slug。generator 側で Qiita 記事ファイル名として利用 */
    qiitaSlug: z.string().optional(),
  })
  // S-1: 未知キー (qiitaPayload や typo) を fail-closed で reject する。
  // scripts 側 schema は `.strict()` で揃っており、frontend 側だけ緩い
  // passthrough になっていると多層防御の片側が抜ける。
  .strict()

/** 記事 frontmatter の型 (parse 後) */
export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>
