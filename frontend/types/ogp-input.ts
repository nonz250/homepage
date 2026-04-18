/**
 * Satori OGP 画像生成の入力境界型。
 *
 * Satori のテンプレート (`utils/ogp/ogpTemplate.tsx`) は JSX を解釈するが、
 * 動的な属性値 (特に `<img src>`) に外部由来の文字列が入ると XSS / 外部
 * リクエスト誘導 (SSRF に準ずる) のリスクがある。そこでテンプレートに渡す
 * 文字列は必ず `SafeText` brand 型を経由させ、build 時に「サニタイズされた
 * 値」であることを型レベルで保証する。
 *
 * 設計 v4 5.2 節 / Sec M-8 参照。
 *
 * 注意:
 *   - `SafeText` は実装上ただの `string` だが、brand で型レベルに差を付けて
 *     いるため、`"..." as SafeText` のような cast を避け、必ず `toSafeText`
 *     を通すこと。テンプレート側が `<img src={...}>` のような属性に
 *     `SafeText` 以外を受け付けない構造にすれば、うっかり記事本文の素の
 *     文字列を流し込む経路を塞げる。
 *   - `toSafeText` は長さ制限 + 制御文字の除去のみ行う最小サニタイザである。
 *     Satori は JSX children としてテキストを受ける限り HTML エスケープを
 *     行うため、HTML 構文除去はここでは行わない (二重サニタイズ回避)。
 */

/** `SafeText` にだけ付くタグ。外部に export しないことで cast を事実上禁止する */
declare const __safeOgpBrand: unique symbol

/**
 * サニタイズ済み + 長さ制限済みのテキスト文字列。
 *
 * `toSafeText` でのみ生成する想定。単なる string リテラルや外部入力を直接
 * `SafeText` として扱うことは型システムが拒否する。
 */
export type SafeText = string & { readonly [__safeOgpBrand]: 'safe' }

/**
 * Satori OGP テンプレートに渡す入力。
 *
 * - `title`: 記事タイトル (2 行までで ellipsis 表示)
 * - `date`: 公開日などの補助テキスト (例: `2026-04-18`)
 * - `tags`: topics 配列 (UI 上は 0〜N 個表示する想定だが、テンプレート側で
 *            上限を制御)
 * - `emoji`: 先頭に表示する絵文字 1 字程度。無ければテンプレート側で省略
 * - `theme`: 当面 `light` のみ。将来 `dark` を追加する場合の switch ポイント
 */
export interface SafeOgpInput {
  readonly title: SafeText
  readonly date: SafeText
  readonly tags: readonly SafeText[]
  readonly emoji?: SafeText
  readonly theme: 'light'
}

/**
 * 長さ制限と制御文字除去のみを行うサニタイザ。
 *
 * - `\u0000`-`\u001F` / `\u007F`-`\u009F` の制御文字を除去
 * - `maxLength` を超える部分は切り詰め (サロゲートペア境界を考慮)
 * - 先頭末尾の空白は除去 (表示崩れ防止)
 *
 * @param raw 任意の入力文字列
 * @param maxLength 許容する最大文字数 (必須で指定させ、呼び出し側に文脈を
 *                   意識させる。0 以下はエラーにはせず空文字を返す)
 */
export function toSafeText(raw: string, maxLength: number): SafeText {
  if (maxLength <= 0) {
    return '' as SafeText
  }
  const withoutControl = raw.replace(
    // 制御文字クラス (ASCII C0 と C1)。表示できず、レンダラが崩れる原因になる
    // ため除去する。
    /[\u0000-\u001F\u007F-\u009F]/g,
    '',
  )
  const trimmed = withoutControl.trim()
  if (trimmed.length <= maxLength) {
    return trimmed as SafeText
  }
  // 多バイト文字を安全に数えるため Array.from (コードポイント単位) を使う。
  const codepoints = Array.from(trimmed)
  if (codepoints.length <= maxLength) {
    return trimmed as SafeText
  }
  return codepoints.slice(0, maxLength).join('') as SafeText
}
