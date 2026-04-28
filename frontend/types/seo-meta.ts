/**
 * Nuxt の `useSeoMeta` に渡すオブジェクトのうち、本プロジェクトが
 * 実際に使う subset の型を定義する。
 *
 * `useSeoMeta` の入力型は `@unhead/vue` 由来で広範な union を持つが、
 * 本プロジェクトが必要とするフィールドだけに絞ることで build hook /
 * 純関数経路 (utils/seo/buildArticleSeoMeta.ts) が auto-import を
 * 持たない unit test 環境でも安全に型解決できるようにする。
 */

/** Twitter Card 種別 */
export type TwitterCardType =
  | 'summary'
  | 'summary_large_image'
  | 'app'
  | 'player'

/**
 * 記事ページなどで `useSeoMeta` に渡す値オブジェクトの型。
 *
 * フィールドの並びは https://ogp.me と Twitter Card / Facebook OG の
 * 仕様順 (kebab → camelCase) に合わせている。
 */
export interface UseSeoMetaInput {
  readonly description: string
  readonly ogType: 'article' | 'website'
  readonly ogTitle: string
  readonly ogDescription: string
  readonly ogUrl: string
  readonly ogImage: string
  readonly ogImageType: string
  readonly ogImageWidth: number
  readonly ogImageHeight: number
  readonly ogImageAlt: string
  readonly twitterCard: TwitterCardType
  readonly twitterTitle: string
  readonly twitterDescription: string
  readonly twitterImage: string
  readonly twitterImageAlt: string
}
