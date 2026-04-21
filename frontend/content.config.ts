import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineCollection, defineContentConfig } from '@nuxt/content'
import { articleFrontmatterSchema } from './content/schema/article'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * リポジトリ root からの相対でコンテンツディレクトリを解決する。
 * `content.config.ts` は `frontend/` 配下にあるため、ひとつ上が root。
 */
const REPO_ROOT = resolve(__dirname, '..')

/**
 * 本サイトが読み込む唯一の記事ソースディレクトリ (v4)。
 *
 * v3 までは `articles/` (Zenn Connect 共有) と `site-articles/` (本サイト限定)
 * の 2 箇所を同一コレクションとして読み込んでいたが、v4 で以下の構造に改めた:
 *
 *   - `site-articles/*.md`: 唯一の原典。`site/zenn/qiita` の boolean フラグ
 *     で配信先を制御する
 *   - `articles/*.md`:      generator (scripts/) が生成する派生物。Zenn Connect
 *     が読む入力としてのみ存在し、frontend は参照しない
 *
 * したがって本ファイルでは `site-articles/` のみを source に指定する。
 * `articles/` 側の記事は `site: true` のものを原典から zenn ストリンガーで
 * 出力したもの (byte-parity 保証) であり、frontend が二重に読む必要はない。
 */
const ARTICLES_SOURCE_DIR = resolve(REPO_ROOT, 'site-articles')

/** Markdown を収集する glob パターン (サブディレクトリ非対象) */
const ARTICLE_INCLUDE_GLOB = '**/*.md'

/**
 * Nuxt Content v3 のコレクション定義。
 *
 * - articles: `site-articles/` のみを読み込む (v4)。配信先は frontmatter の
 *   `site/zenn/qiita` フラグで決まる。本サイト向けは `site: true` のものを
 *   composable (useArticles/useArticle) でさらにフィルタする。
 * - frontmatter のバリデーションは `content/schema/article.ts` に切り出し、
 *   単体テストでも同じ schema を利用して検証する。
 */
export default defineContentConfig({
  collections: {
    articles: defineCollection({
      type: 'page',
      source: [
        {
          cwd: ARTICLES_SOURCE_DIR,
          include: ARTICLE_INCLUDE_GLOB,
        },
      ],
      schema: articleFrontmatterSchema,
    }),
  },
})
