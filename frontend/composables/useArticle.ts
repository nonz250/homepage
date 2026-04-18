/**
 * 記事 1 件を slug で取得する composable。
 *
 * `queryCollection('articles').path('/slug').first()` をラップし、UI 層からの
 * 呼び出しを最小化する。プレビュー状態による公開判定は `useArticles` と
 * 同じ純関数 (`isArticleVisibleNow`) を使うことで仕様のずれを防ぐ。
 */
import { queryCollection } from '#imports'
import { useContentPreview } from './useContentPreview'
import {
  isArticleVisibleNow,
  toArticle,
  type Article,
} from '../utils/article/articleVisibility'

/** `useArticle` の挙動を制御するオプション */
export interface UseArticleOptions {
  /** true のとき下書き・予約投稿でも取得を許可 */
  readonly preview?: boolean
}

/** 記事 1 件取得に用いる path プレフィックス */
const ARTICLE_PATH_PREFIX = '/'

/**
 * slug で指定した記事を 1 件取得する。
 *
 * - 存在しない slug の場合は null
 * - preview でない場合、下書きまたは未公開 (published_at が未来) の記事は null
 * - preview = true なら条件無視で取得
 *
 * 返り値には `body` 等の本文情報はあえて含めず、ページ側で `queryCollection`
 * を直接呼ぶ、もしくは Phase 2 で `useArticleContent` のような別 composable を
 * 追加する方針とする (YAGNI)。
 */
export async function useArticle(
  slug: string,
  opts: UseArticleOptions = {},
): Promise<Article | null> {
  const preview = opts.preview ?? useContentPreview()
  const item = await queryCollection('articles')
    .path(`${ARTICLE_PATH_PREFIX}${slug}`)
    .first()
  if (item === null) {
    return null
  }
  if (!preview && !isArticleVisibleNow(item, Date.now())) {
    return null
  }
  return toArticle(item)
}
