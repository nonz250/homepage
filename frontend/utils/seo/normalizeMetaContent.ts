/**
 * `<meta>` の `content` 属性に入れる文字列を正規化する純関数。
 *
 * 記事の `description` は Nuxt Content が本文先頭段落から auto-generate する
 * ため改行・連続スペースを含み得る。HTML5 仕様上は属性値内の改行は valid
 * だが、外部 OGP パーサ (Slack の link unfurling 等) の挙動を整える防御的な
 * 正規化として、SNS に出る文字列をデバッガで確認しやすくする目的も兼ねる。
 *
 * - 全種類の連続空白 (改行・タブ・複数スペース) を半角スペース 1 つに圧縮
 * - 両端の空白を除去
 *
 * 受け取った文字列が結果的に空になった場合は空文字列を返す。呼び出し側で
 * fallback 文字列に差し替える責務を持つ。
 */
export function normalizeMetaContent(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
