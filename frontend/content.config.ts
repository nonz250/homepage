import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineCollection, defineContentConfig } from '@nuxt/content'
import { articleFrontmatterSchema } from './content/schema/article'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Nuxt Content v3 のコレクション定義。
 *
 * - articles: リポジトリ root 直下の `articles/` を参照する
 *   (Zenn Connect 互換。ADR `phase-1-content-source.md` V-1 に準拠)
 * - frontmatter のバリデーションは `content/schema/article.ts` に切り出し、
 *   単体テストでも同じ schema を利用して検証する
 */
export default defineContentConfig({
  collections: {
    articles: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, '../articles'),
        include: '**/*.md',
      },
      schema: articleFrontmatterSchema,
    }),
  },
})
