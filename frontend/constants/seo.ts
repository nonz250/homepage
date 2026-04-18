/**
 * SEO / OGP 表示に関する定数を集約するモジュール。
 *
 * - 自サイトの OG 画像パス
 * - twitter:card 等、ページ単位で上書きしたい場合の既定値
 *
 * を置く。OGP 取得 (外部リンクカード) 用の定数は `constants/ogp.ts` が責務を
 * 持つため、こちらは「自サイトの表示メタ」に限定する単一責任とする。
 */

/**
 * 記事個別ページなどで `og:image` に載せる既定画像の public パス (先頭スラッシュ込み)。
 *
 * `runtimeConfig.public.baseUrl` と文字列結合して絶対 URL にする。
 * Batch B の Satori OGP では記事ごとに画像を差し替える予定のため、本定数は
 * 既定 fallback 値として残し続ける想定。
 */
export const DEFAULT_OG_IMAGE_PATH = '/images/homepage-ogp.webp'

/**
 * 記事個別 OGP PNG を公開配置する public パスのプレフィックス (先頭スラッシュ込み)。
 *
 * `nuxt:build:public-assets` hook で `.output/public/ogp/<slug>.png` として
 * 書き出されるファイルを指す。generate 後はブラウザ側から
 * `https://<origin>/ogp/<slug>.png` として取得可能。
 */
export const ARTICLE_OG_IMAGE_PATH_PREFIX = '/ogp/'

/**
 * 記事個別 OGP PNG の拡張子。
 */
export const ARTICLE_OG_IMAGE_EXTENSION = '.png'

/**
 * 指定 slug に対応する記事個別 OGP 画像の public パスを返す純関数。
 *
 * 入力 slug は content collection が validator 済みのものを前提とするが、
 * 念のため path-traversal に使える文字 (`/`, `..`, null 等) を含む場合は
 * fallback として DEFAULT_OG_IMAGE_PATH を返す。これにより万一の変なデータ
 * でも外部リソースを踏みに行く経路を塞ぐ (設計 v4 Sec M-8)。
 */
export function resolveArticleOgImagePath(slug: string): string {
  // content collection の slug は `[a-z0-9][a-z0-9_-]*` に限定している
  // (content/schema/article.ts)。ここでもパス構成に使える文字だけを
  // 許可して fallback する二重防御。
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    return DEFAULT_OG_IMAGE_PATH
  }
  return `${ARTICLE_OG_IMAGE_PATH_PREFIX}${slug}${ARTICLE_OG_IMAGE_EXTENSION}`
}
