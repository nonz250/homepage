/**
 * `/feed.xml` を配信する Nitro server handler。
 *
 * 責務は以下の 3 つ:
 *   1. ファイルシステムから記事一覧を読み込み (`loadArticlesFromFs`)
 *   2. 公開判定 (`isArticleVisibleNow`) と `published_at` 降順ソートを行う
 *   3. `buildRssFeed` 純関数で RSS 2.0 XML を生成して返す
 *
 * 本 handler は副作用 (FS I/O, HTTP ヘッダー設定) を担当し、純粋計算は
 * `buildRssFeed` に委譲する分離構造。`prerender` 対象に含めて generate 時に
 * `.output/public/feed.xml` として emit する運用を想定している。
 *
 * fail-safe:
 *   - 記事ディレクトリが存在しない場合は空フィードを返す (500 を避ける)
 *   - 個別の記事で `title` が空・`published_at` が無効な場合はその記事を
 *     feed から除外する (`<item>` が崩れないよう fail-closed)
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { loadArticlesFromFs } from '../../utils/prerender/loadArticlesFromFs'
import { isArticleVisibleNow } from '../../utils/article/articleVisibility'
import {
  buildRssFeed,
  type RssFeedItem,
} from '../../utils/rss/buildRssFeed'

/** RSS XML の Content-Type */
const CONTENT_TYPE_RSS = 'application/rss+xml; charset=utf-8'

/**
 * `runtimeConfig.public.baseUrl` が未設定の場合のフォールバック URL。
 *
 * 本番 / preview 経路では `nuxt.config.ts` で明示的に設定されるため、
 * この値が採用されるのは dev 起動時の事故ケースのみ。`<link>` が壊れた
 * フィードを返さないための最低限の保険。
 */
const FALLBACK_BASE_URL = 'https://nozomi.bike'

/**
 * server route の相対パスから記事ディレクトリの絶対パスを解決する。
 *
 * `frontend/server/routes/feed.xml.get.ts` から見て
 *   - `../../../articles`      → リポジトリ root/articles (Zenn 共有)
 *   - `../../../site-articles` → リポジトリ root/site-articles (本サイト限定)
 * の 2 箇所を走査する。`nuxt.config.ts` の `nitro:config` hook と同じ構成で、
 * 両者に title/published/published_at の値をそろえる必要がある。
 */
function resolveArticleSourceDirs(): readonly string[] {
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFile)
  // server/routes → server → frontend → repo root
  const repoRoot = resolve(currentDir, '../../../')
  return [
    resolve(repoRoot, 'articles'),
    resolve(repoRoot, 'site-articles'),
  ] as const
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event) as {
    public?: { baseUrl?: string }
  }
  const baseUrl =
    typeof config.public?.baseUrl === 'string' && config.public.baseUrl !== ''
      ? config.public.baseUrl
      : FALLBACK_BASE_URL

  const now = Date.now()
  const articles = loadArticlesFromFs(resolveArticleSourceDirs())

  // 公開判定 → タイトル/日時の健全性チェック → `published_at` 降順ソート。
  // `buildRssFeed` は入力順を保持する純関数なので、ソート責務はここに置く。
  const visibleItems: RssFeedItem[] = articles
    .filter((article) => isArticleVisibleNow(article, now))
    .filter((article) => article.title !== '' && article.published_at !== undefined)
    .sort((a, b) => {
      // フィルタ済みで undefined ではないことは保証されているが、
      // 型ガードのため再度 fallback を置く。
      const aMs = a.published_at ? Date.parse(a.published_at) : 0
      const bMs = b.published_at ? Date.parse(b.published_at) : 0
      return bMs - aMs
    })
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      // フィルタ済み。undefined 残存に備えて ?? で空文字に倒す。
      publishedAt: article.published_at ?? '',
    }))

  const xml = buildRssFeed({
    baseUrl,
    buildTime: new Date(now),
    items: visibleItems,
  })

  setResponseHeader(event, 'content-type', CONTENT_TYPE_RSS)
  return xml
})
