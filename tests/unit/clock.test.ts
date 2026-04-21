import { describe, expect, it } from 'vitest'
import {
  fixedClock,
  isFuturePublish,
  systemClock,
  type Clock,
} from '../../scripts/lib/clock'

/**
 * Clock 抽象のテスト。
 *
 * - systemClock は本番経路でのみ使用し、テストからは fixedClock を注入する。
 * - isFuturePublish は published_at 文字列 (3 形式) と Clock を受け取り、
 *   現在時刻よりも未来なら true を返す純関数。
 * - 現時点では JST (+09:00) を暗黙の基準タイムゾーンとし、`YYYY-MM-DD HH:mm`
 *   (= Zenn legacy 形式) の曖昧さを JST として解釈する。
 */
describe('Clock', () => {
  describe('systemClock', () => {
    it('returns a Date instance close to the current time', () => {
      const before = Date.now()
      const now = systemClock.now()
      const after = Date.now()
      expect(now).toBeInstanceOf(Date)
      // システム時計由来であることを "±1s" の許容範囲で確認。
      expect(now.getTime()).toBeGreaterThanOrEqual(before - 1)
      expect(now.getTime()).toBeLessThanOrEqual(after + 1)
    })
  })

  describe('fixedClock', () => {
    it('returns a Date that matches the frozen ISO string', () => {
      const frozen = fixedClock('2026-04-20T12:00:00Z')
      const now = frozen.now()
      expect(now.toISOString()).toBe('2026-04-20T12:00:00.000Z')
    })

    it('returns fresh Date instances so callers cannot mutate the frozen value', () => {
      const frozen = fixedClock('2026-04-20T12:00:00Z')
      const a = frozen.now()
      const b = frozen.now()
      expect(a).not.toBe(b)
      expect(a.toISOString()).toBe(b.toISOString())
    })

    it('throws on an invalid ISO string', () => {
      expect(() => fixedClock('not-a-date')).toThrow()
    })
  })

  describe('isFuturePublish', () => {
    const clockAt = (iso: string): Clock => fixedClock(iso)

    it('returns true when published_at (Zenn legacy) is after the current JST time', () => {
      // JST 2026-04-19 21:00 = UTC 2026-04-19 12:00. now = UTC 2026-04-19 11:59.
      const clock = clockAt('2026-04-19T11:59:00Z')
      expect(isFuturePublish('2026-04-19 21:00', clock)).toBe(true)
    })

    it('returns false when published_at (Zenn legacy) is before the current JST time', () => {
      // now = UTC 2026-04-19 13:00 > published UTC 2026-04-19 12:00
      const clock = clockAt('2026-04-19T13:00:00Z')
      expect(isFuturePublish('2026-04-19 21:00', clock)).toBe(false)
    })

    it('returns false when published_at equals the current time (strictly future only)', () => {
      const clock = clockAt('2026-04-19T12:00:00Z')
      expect(isFuturePublish('2026-04-19 21:00', clock)).toBe(false)
    })

    it('interprets ISO offset published_at directly', () => {
      // published = 2026-04-19T21:00:00+09:00 = 2026-04-19T12:00:00Z
      const clock = clockAt('2026-04-19T11:59:00Z')
      expect(isFuturePublish('2026-04-19T21:00:00+09:00', clock)).toBe(true)
    })

    it('interprets ISO UTC published_at directly', () => {
      // published = 2026-04-19T12:00:00Z
      const clock = clockAt('2026-04-19T11:59:00Z')
      expect(isFuturePublish('2026-04-19T12:00:00Z', clock)).toBe(true)
    })

    it('throws when published_at is not in any accepted format', () => {
      const clock = clockAt('2026-04-19T12:00:00Z')
      expect(() => isFuturePublish('2026/04/19 21:00', clock)).toThrow()
    })
  })
})
