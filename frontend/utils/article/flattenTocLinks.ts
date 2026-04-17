/**
 * Nuxt Content (@nuxtjs/mdc) が生成するネストした TOC links を
 * 1 次元配列に平坦化する純関数。
 *
 * `ArticleToc` コンポーネントは props として平坦な
 * `{ id, text, depth }[]` を受け取る想定のため、ここで変換する。
 * 本ロジックを切り出しておくことで、将来 TOC の表現を変える際に
 * 影響範囲を 1 ファイルに限定できる (SRP)。
 */

/** 単一の TOC ノード (ネスト前の中間型) */
export interface TocLink {
  id?: string
  text?: string
  depth?: number
  children?: TocLink[]
}

/** UI に渡す平坦化済み TOC 要素 */
export interface FlatTocHeading {
  readonly id: string
  readonly text: string
  readonly depth: number
}

/**
 * ネストされた links をプレオーダー走査で平坦化する。
 *
 * - `id` / `text` / `depth` のいずれかが欠落しているノードは無視する
 * - 入力が `undefined` の場合も空配列で返す (fail-closed)
 */
export function flattenTocLinks(
  links: readonly TocLink[] | undefined,
): FlatTocHeading[] {
  if (!Array.isArray(links)) {
    return []
  }
  const result: FlatTocHeading[] = []
  for (const link of links) {
    if (
      typeof link.id === 'string' &&
      typeof link.text === 'string' &&
      typeof link.depth === 'number'
    ) {
      result.push({ id: link.id, text: link.text, depth: link.depth })
    }
    if (Array.isArray(link.children) && link.children.length > 0) {
      for (const child of flattenTocLinks(link.children)) {
        result.push(child)
      }
    }
  }
  return result
}
