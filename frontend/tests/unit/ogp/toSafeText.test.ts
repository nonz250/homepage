/**
 * `types/ogp-input.ts` の `toSafeText` ユニットテスト。
 *
 * カバー範囲:
 *   - 制御文字の除去
 *   - 長さ制限 (コードポイント単位、サロゲートペア境界)
 *   - 先頭末尾の空白除去
 *   - maxLength <= 0 の境界
 */
import { describe, expect, it } from 'vitest'
import { toSafeText } from '../../../types/ogp-input'

describe('toSafeText', () => {
  it('passes through a normal ASCII string', () => {
    const result = toSafeText('hello world', 100)
    expect(result).toBe('hello world')
  })

  it('strips ASCII control characters', () => {
    const result = toSafeText('ab\u0000cd\u001Eef', 100)
    expect(result).toBe('abcdef')
  })

  it('strips C1 control characters', () => {
    const result = toSafeText('a\u0085b\u009Fc', 100)
    expect(result).toBe('abc')
  })

  it('trims leading and trailing whitespace', () => {
    const result = toSafeText('   padded   ', 100)
    expect(result).toBe('padded')
  })

  it('truncates strings longer than maxLength by codepoint', () => {
    const result = toSafeText('abcdefghij', 5)
    expect(result).toBe('abcde')
  })

  it('counts surrogate pair emoji as single codepoint', () => {
    // 1 emoji (🎉 = U+1F389, surrogate pair) + 3 ASCII なので 4 codepoint
    const result = toSafeText('🎉abc', 3)
    expect(result).toBe('🎉ab')
  })

  it('returns empty string when maxLength is zero or negative', () => {
    expect(toSafeText('hello', 0)).toBe('')
    expect(toSafeText('hello', -1)).toBe('')
  })

  it('returns original string when exactly at maxLength', () => {
    const result = toSafeText('abc', 3)
    expect(result).toBe('abc')
  })

  it('handles empty input', () => {
    const result = toSafeText('', 100)
    expect(result).toBe('')
  })

  it('handles Japanese text within byte-vs-codepoint difference', () => {
    // 「日本語テスト」は 6 codepoint。maxLength 5 で切り詰めて「日本語テス」。
    const result = toSafeText('日本語テスト', 5)
    expect(result).toBe('日本語テス')
  })
})
