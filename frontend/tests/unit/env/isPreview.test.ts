import { describe, expect, it } from 'vitest'
import { normalizePreviewFlag } from '../../../utils/env/isPreview'

/**
 * `normalizePreviewFlag` の単体テスト。
 *
 * 入力ネットワークを網羅し、truthy / falsy いずれに分類されるべきかを
 * 境界値として明示する。trim の挙動 (前後空白) と大文字小文字非依存性も
 * あわせて検証する。
 */
describe('normalizePreviewFlag', () => {
  describe('falsy inputs', () => {
    it.each([
      ['undefined (not set)', undefined],
      ['empty string', ''],
      ['whitespace only', '  '],
      ["'0'", '0'],
      ["'false'", 'false'],
      ["'FALSE'", 'FALSE'],
      ["'no'", 'no'],
      ["'random'", 'random'],
    ])('returns false for %s', (_label, input) => {
      expect(normalizePreviewFlag(input)).toBe(false)
    })
  })

  describe('truthy inputs', () => {
    it.each([
      ["'1'", '1'],
      ["'true'", 'true'],
      ["'TRUE'", 'TRUE'],
      ["'yes'", 'yes'],
      ["'YES'", 'YES'],
      ["'  1  ' (trimmed)", '  1  '],
      ["' true '", ' true '],
    ])('returns true for %s', (_label, input) => {
      expect(normalizePreviewFlag(input)).toBe(true)
    })
  })
})
