/**
 * Nuxt の `useHead({ meta: [...] })` に渡す meta entry のうち、
 * 本プロジェクトが実際に使う subset の型を定義する。
 *
 * `@unhead/vue` の本来の型は広範な union を持つが、本プロジェクトが
 * 必要とする項目だけに絞ることで、auto-import を持たない unit test
 * 環境 (utils/seo/buildArticleSeoMeta.ts 経由) でも安全に型解決できる。
 */

interface ArticleMetaEntryBase {
  readonly content: string
  readonly tagPriority?: number
  /**
   * 本プロジェクトでは data-* は使わないが、これがないと
   * `useHead({ meta: [...] })` に渡したときに index signature の不在で
   * 型エラーになる。
   */
  readonly [dataAttribute: `data-${string}`]: string | undefined
}

/**
 * `useHead` の meta 配列に渡す 1 エントリ。
 *
 * `property` と `name` を両方 optional にした 1 つの型にしないのは、
 * unhead の meta 型が `name` / `property` / `http-equiv` などの
 * どれか 1 つを必須とする union で、どの member にも代入できなくなるため。
 */
export type ArticleMetaEntry =
  | (ArticleMetaEntryBase & { readonly property: string })
  | (ArticleMetaEntryBase & { readonly name: string })
