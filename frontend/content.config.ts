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

/** Zenn Connect と共有する記事ディレクトリ */
const ZENN_SHARED_ARTICLES_DIR = resolve(REPO_ROOT, 'articles')

/**
 * 本サイト限定で公開する記事ディレクトリ。
 * Zenn Connect は `articles/` のみを参照するため、ここに置いた記事は
 * 物理的に Zenn には公開されない。詳細は
 * `frontend/docs/decisions/site-only-articles.md` を参照。
 */
const SITE_ONLY_ARTICLES_DIR = resolve(REPO_ROOT, 'site-articles')

/** Markdown を収集する glob パターン (サブディレクトリ非対象) */
const ARTICLE_INCLUDE_GLOB = '**/*.md'

/**
 * Nuxt Content v3 のコレクション定義。
 *
 * - articles: `articles/` (Zenn 共有) と `site-articles/` (本サイト限定) を
 *   同一コレクションとして読み込む。v3 の `source` は `CollectionSource[]` を
 *   受け付けるため、配列で複数ディレクトリを指定する (ADR V-3 参照)。
 * - 両ディレクトリで slug が衝突した場合は build 時に fail させる
 *   (assertNoSlugCollision をビルドステップで呼び出す)。
 * - frontmatter のバリデーションは `content/schema/article.ts` に切り出し、
 *   単体テストでも同じ schema を利用して検証する。
 */
export default defineContentConfig({
  collections: {
    articles: defineCollection({
      type: 'page',
      source: [
        {
          cwd: ZENN_SHARED_ARTICLES_DIR,
          include: ARTICLE_INCLUDE_GLOB,
        },
        {
          cwd: SITE_ONLY_ARTICLES_DIR,
          include: ARTICLE_INCLUDE_GLOB,
        },
      ],
      schema: articleFrontmatterSchema,
    }),
  },
})
