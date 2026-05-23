/**
 * `subset-font` パッケージの ambient declaration。
 *
 * 本家パッケージは型宣言を同梱しておらず DefinitelyTyped の `@types/subset-font`
 * を入れると依存ツリーが大きく動くため、本プロジェクトが使う最小シグネチャだけを
 * ローカルで宣言する。利用箇所は `utils/ogp/buildOgpFontBuffer.ts` のみで、
 * `targetFormat` には `truetype` / `woff` / `woff2` を渡す。
 */
declare module 'subset-font' {
  /** subset-font が受け付ける出力フォーマット */
  export type TargetFormat = 'truetype' | 'woff' | 'woff2'

  /**
   * フォント Buffer から指定文字列だけを含むサブセットを生成する。
   *
   * @param source ソースフォントの Buffer (TTF / WOFF / WOFF2)
   * @param text サブセットに含める文字列 (全 codepoint が対象)
   * @param options 出力フォーマット指定
   */
  const subsetFont: (
    source: Buffer,
    text: string,
    options: { targetFormat: TargetFormat },
  ) => Promise<Buffer>

  export default subsetFont
}
