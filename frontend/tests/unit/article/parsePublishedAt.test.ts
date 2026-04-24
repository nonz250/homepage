import { describe, expect, it } from 'vitest'
import { parsePublishedAtMs } from '../../../utils/article/parsePublishedAt'

/**
 * `parsePublishedAtMs` の単体テスト。
 *
 * 仕様の核心:
 *   - Zenn Legacy 形式 (`YYYY-MM-DD HH:mm`) は **常に JST (UTC+9) として
 *     解釈** する。CI (UTC) と JST のホストで判定がブレないこと。
 *   - ISO 8601 with offset / `Z` 付きはホスト TZ に左右されず、表記通りの
 *     絶対時刻として解釈する。
 *   - 不正値は `NaN` を返す (`Date.parse` 互換)。
 *
 * Issue #59 (記事直リン 404) のリグレッション防止が主目的。Zenn Legacy
 * 形式を CI の UTC で評価して未来扱いし、prerender から記事が消える事故を
 * 二度と起こさないよう絶対時刻でテストを固定する。
 */
describe('parsePublishedAtMs', () => {
  describe('Zenn Legacy format (YYYY-MM-DD HH:mm) — interpreted as JST', () => {
    it('parses 21:00 JST as 12:00 UTC of the same day', () => {
      // 2026-04-23 21:00 JST = 2026-04-23T12:00:00Z
      const expected = Date.parse('2026-04-23T12:00:00Z')
      expect(parsePublishedAtMs('2026-04-23 21:00')).toBe(expected)
    })

    it('parses 00:00 JST as previous day 15:00 UTC', () => {
      // 2026-04-24 00:00 JST = 2026-04-23T15:00:00Z
      const expected = Date.parse('2026-04-23T15:00:00Z')
      expect(parsePublishedAtMs('2026-04-24 00:00')).toBe(expected)
    })

    it('parses 09:00 JST as 00:00 UTC of the same day', () => {
      const expected = Date.parse('2026-04-23T00:00:00Z')
      expect(parsePublishedAtMs('2026-04-23 09:00')).toBe(expected)
    })
  })

  describe('ISO 8601 with offset', () => {
    it('parses +09:00 offset as JST', () => {
      const expected = Date.parse('2026-04-23T12:00:00Z')
      expect(parsePublishedAtMs('2026-04-23T21:00:00+09:00')).toBe(expected)
    })

    it('parses negative offset', () => {
      const expected = Date.parse('2026-04-23T20:00:00Z')
      expect(parsePublishedAtMs('2026-04-23T15:00:00-05:00')).toBe(expected)
    })
  })

  describe('ISO 8601 UTC (Z suffix)', () => {
    it('parses Z as UTC', () => {
      const expected = Date.parse('2026-04-23T12:00:00Z')
      expect(parsePublishedAtMs('2026-04-23T12:00:00Z')).toBe(expected)
    })
  })

  describe('invalid input', () => {
    it('returns NaN for an unparseable string', () => {
      expect(Number.isNaN(parsePublishedAtMs('not-a-date'))).toBe(true)
    })

    it('returns NaN for an empty string', () => {
      expect(Number.isNaN(parsePublishedAtMs(''))).toBe(true)
    })
  })
})
