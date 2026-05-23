/**
 * 記事個別ページに適用する SEO / OGP / Twitter Card メタタグの
 * 値オブジェクトを純関数で組み立てる。
 *
 * SFC (`pages/articles/[...slug].vue`) はこの関数の戻り値を
 * `useHead({ meta: [...] })` にそのまま流すだけにとどめ、URL 組み立て /
 * fallback / Slack unfurl 用の tagPriority 付与などのロジックを
 * このユーティリティ側に集約することでテスタブルにする。
 *
 * 設計 v2 Step 13-14 を参照。
 */
import type { ArticleMetaEntry } from '../../types/seo-meta'
import {
  OGP_IMAGE_MIME_TYPE,
  resolveArticleOgImagePath,
} from '../../constants/seo'
import { OGP_IMAGE_HEIGHT, OGP_IMAGE_WIDTH } from '../../constants/ogp'
import { buildAbsoluteUrl } from './buildAbsoluteUrl'

// Slack の Link Expanding は HTTP Range で head 先頭しか fetch しない。
// Unhead v2 の `tagPriority: 'critical'` (= 2) は Capo.js のソート規則で
// 同期 stylesheets より後ろに置かれるため、数値で直接負値を指定して
// 確実に <style> より前に押し上げる。
const PRE_STYLE_PRIORITY = -8

/** 記事ページは大きい画像で表示するため `summary_large_image` 固定 */
const ARTICLE_TWITTER_CARD_TYPE = 'summary_large_image'

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
 * `useHead({ meta: [...] })` にそのまま渡せる meta 配列を組み立てる。
 *
 * - 必須タグ (og:title / og:image / og:description / og:url / og:type /
 *   twitter:image / description) には PRE_STYLE_PRIORITY を付け、Slack の
 *   HTTP Range fetch でも先頭で拾えるよう <style> より前に押し上げる
 * - og:image は記事個別の OGP PNG (`/ogp/<slug>.png`) を絶対 URL で指す
 * - 寸法 / MIME / alt も Slack 等の unfurl で必要なため全部詰める
 * - Twitter Card 系列 (twitter:card / twitter:title / twitter:description /
 *   twitter:image:alt) も同じ画像/タイトル/description で再掲する
 */
export function buildArticleSeoMeta(
  input: BuildArticleSeoMetaInput,
): ArticleMetaEntry[] {
  const canonicalUrl = buildAbsoluteUrl(
    input.baseUrl,
    `/articles/${input.slug}/`,
  )
  const ogImageUrl = buildAbsoluteUrl(
    input.baseUrl,
    resolveArticleOgImagePath(input.slug),
  )
  const ogImageAlt = `${input.title} - Nozomi Hosaka`
  return [
    { property: 'og:title', content: input.title, tagPriority: PRE_STYLE_PRIORITY },
    { property: 'og:image', content: ogImageUrl, tagPriority: PRE_STYLE_PRIORITY },
    { property: 'og:description', content: input.description, tagPriority: PRE_STYLE_PRIORITY },
    { property: 'og:url', content: canonicalUrl, tagPriority: PRE_STYLE_PRIORITY },
    { property: 'og:type', content: 'article', tagPriority: PRE_STYLE_PRIORITY },
    { name: 'twitter:image', content: ogImageUrl, tagPriority: PRE_STYLE_PRIORITY },
    { name: 'description', content: input.description, tagPriority: PRE_STYLE_PRIORITY },
    { property: 'og:image:type', content: OGP_IMAGE_MIME_TYPE },
    { property: 'og:image:width', content: String(OGP_IMAGE_WIDTH) },
    { property: 'og:image:height', content: String(OGP_IMAGE_HEIGHT) },
    { property: 'og:image:alt', content: ogImageAlt },
    { name: 'twitter:card', content: ARTICLE_TWITTER_CARD_TYPE },
    { name: 'twitter:title', content: input.title },
    { name: 'twitter:description', content: input.description },
    { name: 'twitter:image:alt', content: ogImageAlt },
  ]
}
