/**
 * articles コレクションを取得する composable。
 *
 * Nuxt Content v3 の `queryCollection('articles')` をラップし、UI 層が
 * 直接クエリビルダーの形状に依存しないようにする。プレビュー状態は
 * `runtimeConfig.contentPreview` (または明示指定) で制御し、本番では
 * 公開済みかつ `published_at` が過去日時の記事のみを返す。
 */
import { queryCollection } from '#imports'
import { useContentPreview } from './useContentPreview'
import {
  isArticleVisibleNow,
  toArticle,
  type Article,
} from '../utils/article/articleVisibility'

export type { Article }

/** `useArticles` の挙動を制御するオプション */
export interface UseArticlesOptions {
  /** true のとき下書き・予約投稿も含めて取得する */
  readonly preview?: boolean
  /** 返却件数の上限。未指定なら全件 */
  readonly limit?: number
}

/**
 * 記事一覧を取得する。
 *
 * - 既定では `published === true` かつ `published_at <= now()` の記事のみ
 * - `opts.preview` が true なら全件
 * - `published_at` 降順でソート
 * - `opts.limit` で件数上限を指定可能
 */
export async function useArticles(
  opts: UseArticlesOptions = {},
): Promise<Article[]> {
  const preview = opts.preview ?? useContentPreview()
  const items = await queryCollection('articles')
    .order('published_at', 'DESC')
    .all()

  const now = Date.now()
  const filtered = preview
    ? items
    : items.filter((item) => isArticleVisibleNow(item, now))

  const mapped = filtered.map((item) => toArticle(item))
  return typeof opts.limit === 'number' ? mapped.slice(0, opts.limit) : mapped
}
