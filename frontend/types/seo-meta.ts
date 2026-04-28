/**
 * Nuxt の `useHead({ meta: [...] })` に渡す meta entry のうち、
 * 本プロジェクトが実際に使う subset の型を定義する。
 *
 * `@unhead/vue` の本来の型は広範な union を持つが、本プロジェクトが
 * 必要とする項目だけに絞ることで、auto-import を持たない unit test
 * 環境 (utils/seo/buildArticleSeoMeta.ts 経由) でも安全に型解決できる。
 */

/**
 * `useHead` の meta 配列に渡す 1 エントリ。
 *
 * `property` (OGP 系) もしくは `name` (Twitter Card / description 等) の
 * いずれかを必須に近い形で持ち、`content` は文字列で表現する。
 * `tagPriority` は Capo.js のソート規則に介入したい場合だけ指定する。
 */
export interface ArticleMetaEntry {
  readonly property?: string
  readonly name?: string
  readonly content: string
  readonly tagPriority?: number
}
