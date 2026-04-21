import { describe, expect, it } from 'vitest'
import { publishedAtSchema } from '../../../scripts/lib/schema/publishedAt'

/**
 * `published_at` は v4 スキーマで 3 形式を受ける:
 *
 *   1. `YYYY-MM-DD HH:mm`            — Zenn Connect 現行フォーマット
 *   2. `YYYY-MM-DDTHH:mm:ss±HH:mm`   — ISO 8601 with numeric offset
 *   3. `YYYY-MM-DDTHH:mm:ssZ`        — ISO 8601 UTC
 *
 * パース後も入力文字列を「そのまま」保持する (byte 一致のため、ISO 変換しない)。
 * 不正形式は zod issue として日本語で期待形式を提示しつつ reject する。
 */
describe('publishedAtSchema', () => {
  describe('format 1: Zenn legacy (YYYY-MM-DD HH:mm)', () => {
    it('accepts the current format used in articles/nonz250-ai-rotom.md', () => {
      const result = publishedAtSchema.safeParse('2026-04-19 21:00')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('2026-04-19 21:00')
      }
    })

    it('accepts midnight 00:00', () => {
      const result = publishedAtSchema.safeParse('2026-01-01 00:00')
      expect(result.success).toBe(true)
    })

    it('rejects seconds in the Zenn legacy format', () => {
      expect(publishedAtSchema.safeParse('2026-04-19 21:00:00').success).toBe(
        false,
      )
    })

    it('rejects an out-of-range hour (24:00)', () => {
      expect(publishedAtSchema.safeParse('2026-04-19 24:00').success).toBe(
        false,
      )
    })

    it('rejects an out-of-range minute (:60)', () => {
      expect(publishedAtSchema.safeParse('2026-04-19 12:60').success).toBe(
        false,
      )
    })
  })

  describe('format 2: ISO 8601 with offset', () => {
    it('accepts the format used in site-articles/2026-04-19-ai-rotom.md', () => {
      const result = publishedAtSchema.safeParse('2026-04-19T16:00:00+09:00')
      expect(result.success).toBe(true)
      if (result.success) {
        // byte 一致: ISO 変換せず入力をそのまま保持する。
        expect(result.data).toBe('2026-04-19T16:00:00+09:00')
      }
    })

    it('accepts negative offset', () => {
      const result = publishedAtSchema.safeParse('2026-04-19T16:00:00-05:00')
      expect(result.success).toBe(true)
    })

    it('rejects offset without a colon', () => {
      expect(
        publishedAtSchema.safeParse('2026-04-19T16:00:00+0900').success,
      ).toBe(false)
    })

    it('rejects offset with hours > 23', () => {
      expect(
        publishedAtSchema.safeParse('2026-04-19T16:00:00+24:00').success,
      ).toBe(false)
    })
  })

  describe('format 3: ISO 8601 UTC (Z)', () => {
    it('accepts UTC Z suffix', () => {
      const result = publishedAtSchema.safeParse('2026-04-19T12:00:00Z')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('2026-04-19T12:00:00Z')
      }
    })

    it('rejects lowercase z suffix', () => {
      expect(publishedAtSchema.safeParse('2026-04-19T12:00:00z').success).toBe(
        false,
      )
    })
  })

  describe('invalid shapes', () => {
    it('rejects a date-only string', () => {
      expect(publishedAtSchema.safeParse('2026-04-19').success).toBe(false)
    })

    it('rejects slash-separated dates', () => {
      expect(publishedAtSchema.safeParse('2026/04/19 21:00').success).toBe(
        false,
      )
    })

    it('rejects a non-string value', () => {
      expect(publishedAtSchema.safeParse(1714_000_000).success).toBe(false)
      expect(publishedAtSchema.safeParse(null).success).toBe(false)
      expect(publishedAtSchema.safeParse(undefined).success).toBe(false)
    })

    it('rejects an empty string', () => {
      expect(publishedAtSchema.safeParse('').success).toBe(false)
    })

    it('emits a Japanese error message listing accepted formats', () => {
      const result = publishedAtSchema.safeParse('not-a-date')
      expect(result.success).toBe(false)
      if (!result.success) {
        const message = result.error.issues[0]?.message ?? ''
        expect(message).toMatch(/published_at/)
        // 期待形式が日本語でアナウンスされていることを確認
        expect(message).toMatch(/形式/)
      }
    })
  })
})
