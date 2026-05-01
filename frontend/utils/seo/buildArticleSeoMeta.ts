/**
 * 記事個別ページに適用する SEO / OGP メタタグの値オブジェクトを純関数で
 * 組み立てる。
 *
 * SFC (`pages/articles/[...slug].vue`) はこの関数の戻り値を `useSeoMeta`
 * にそのまま展開するだけにとどめ、文字列結合や fallback ロジックを
 * このユーティリティ側に集約することでテスタブルにする。
 *
 * 設計 v2 Step 13-14 を参照。
 */
import type { UseSeoMetaInput } from '../../types/seo-meta'
import {
  OGP_IMAGE_MIME_TYPE,
  resolveArticleOgImagePath,
} from '../../constants/seo'
import { OGP_IMAGE_HEIGHT, OGP_IMAGE_WIDTH } from '../../constants/ogp'
import { buildAbsoluteUrl } from './buildAbsoluteUrl'

/** Twitter Card 種別。記事ページは大きい画像で表示するため `summary_large_image` 固定 */
const ARTICLE_TWITTER_CARD_TYPE = 'summary_large_image' as const

/**
 * `buildArticleSeoMeta` の入力。
 */
export interface BuildArticleSeoMetaInput {
  /** 記事 slug (path 構成用) */
  readonly slug: string
  /** 記事タイトル (動的値) */
  readonly title: string
  /** 記事の description / OG description として用いるテキスト */
  readonly description: string
  /** サイト baseUrl (例: `https://nozomi.bike`) */
  readonly baseUrl: string
}

/**
 * `useSeoMeta` にそのまま渡せる引数オブジェクトを組み立てる。
 *
 * - og:image は記事個別の OGP PNG (`/ogp/<slug>.png`) を絶対 URL で指す
 * - 寸法 / MIME / alt も Slack 等の unfurl で必要なため全部詰める
 * - Twitter Card も同じ画像/タイトル/description で再掲する
 */
export function buildArticleSeoMeta(
  input: BuildArticleSeoMetaInput,
): UseSeoMetaInput {
  const canonicalUrl = buildAbsoluteUrl(
    input.baseUrl,
    `/articles/${input.slug}/`,
  )
  const ogImageUrl = buildAbsoluteUrl(
    input.baseUrl,
    resolveArticleOgImagePath(input.slug),
  )
  const ogImageAlt = `${input.title} - Nozomi Hosaka`
  return {
    description: input.description,
    ogType: 'article',
    ogTitle: input.title,
    ogDescription: input.description,
    ogUrl: canonicalUrl,
    ogImage: ogImageUrl,
    ogImageType: OGP_IMAGE_MIME_TYPE,
    ogImageWidth: OGP_IMAGE_WIDTH,
    ogImageHeight: OGP_IMAGE_HEIGHT,
    ogImageAlt: ogImageAlt,
    twitterCard: ARTICLE_TWITTER_CARD_TYPE,
    twitterTitle: input.title,
    twitterDescription: input.description,
    twitterImage: ogImageUrl,
    twitterImageAlt: ogImageAlt,
  }
}
