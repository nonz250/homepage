/**
 * フォントサブセット化に渡す文字列を、subset-font / harfbuzz が
 * 例外を吐く可能性のあるコードポイントから守るためのサニタイザ。
 *
 * 対象 (除去するもの):
 *   - 孤立サロゲート: U+D800 - U+DFFF を単独で含むケース。JS の文字列は
 *     UTF-16 のため、ペアを成さない単独サロゲートが入り込むと
 *     subset-font 内部の文字列処理で TypeError を吐く可能性がある。
 *   - 非文字 (noncharacter): U+FDD0 - U+FDEF, 各 plane 末尾の
 *     U+nFFFE / U+nFFFF (n = 0x0 - 0x10)。Unicode 仕様で「文字として
 *     使用しない」と定義されており、フォント側も glyph を持たない。
 *   - U+FEFF (BOM): フォント subset の入力としてはノイズで、副作用が
 *     出やすい (security-engineer の指摘で明示的に除去)。
 *
 * 通すもの:
 *   - ZWJ (U+200D): 結合絵文字に必須
 *   - 異体字セレクタ (VS15: U+FE0E, VS16: U+FE0F): 絵文字表示制御に必須
 *   - C0 / C1 制御文字: `toSafeText` 側の責務なのでここでは触らない
 *
 * 設計 v2 Step 1-2 を参照。
 */

/** ペアを成さない単独サロゲートを 1 文字ずつ取り除く。 */
function stripLoneSurrogates(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    const isHighSurrogate = code >= 0xd800 && code <= 0xdbff
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff
    if (isHighSurrogate) {
      // ペアになっているか確認。ペアならそのまま 2 つ吐く。
      const next = i + 1 < input.length ? input.charCodeAt(i + 1) : -1
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += input[i] + input[i + 1]
        i++
        continue
      }
      // 孤立 high surrogate → 捨てる
      continue
    }
    if (isLowSurrogate) {
      // ペアの先頭で処理されないまま到達 → 孤立 low surrogate → 捨てる
      continue
    }
    out += input[i]
  }
  return out
}

/** Unicode の noncharacter 領域に該当するか判定する。 */
function isNoncharacterCodePoint(cp: number): boolean {
  // U+FDD0 - U+FDEF
  if (cp >= 0xfdd0 && cp <= 0xfdef) return true
  // 各 plane 末尾 U+nFFFE / U+nFFFF (n = 0x0 - 0x10)
  const lower = cp & 0xffff
  if (lower === 0xfffe || lower === 0xffff) {
    const plane = cp >>> 16
    if (plane >= 0 && plane <= 0x10) return true
  }
  return false
}

/** Byte Order Mark (U+FEFF) */
const CODE_POINT_BOM = 0xfeff

/**
 * subset-font 入力用のサニタイザ。
 *
 * @param raw 任意の文字列 (記事タイトル等)
 * @returns 危険コードポイント除去済み文字列
 */
export function sanitizeFontInputText(raw: string): string {
  if (raw.length === 0) return ''
  const stripped = stripLoneSurrogates(raw)
  let out = ''
  for (const ch of stripped) {
    const cp = ch.codePointAt(0)
    if (cp === undefined) continue
    if (cp === CODE_POINT_BOM) continue
    if (isNoncharacterCodePoint(cp)) continue
    out += ch
  }
  return out
}
