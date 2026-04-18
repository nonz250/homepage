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
