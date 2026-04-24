import { describe, expect, it } from 'vitest'
import {
  isAnalyticsEnabled,
  isValidGtagId,
} from '../../../utils/analytics/isAnalyticsEnabled'

/**
 * GA4 有効化判定 (`isAnalyticsEnabled`) の単体テスト。
 *
 * `plugins/gtag.client.ts` が本関数の真偽値に基づいて gtag.js の読み込みを
 * 分岐させるため、以下を契約として固定する:
 *   - 本番ビルド (NODE_ENV=production) かつ有効な GA4 measurement ID
 *     (`G-XXXXXXXXXX`) が渡されたときのみ true
 *   - 開発ビルドでは ID があっても false (ローカル開発で計測汚染しない)
 *   - ID 未設定 / 形式不正は本番ビルドでも false (fail-closed)
 */

describe('isValidGtagId', () => {
  describe('valid GA4 measurement IDs', () => {
    it.each([
      ['G-XXXXXXXXXX', 'G-XXXXXXXXXX'],
      ['G-1234567890', 'G-1234567890'],
      ['G-AB1234', 'G-AB1234'],
      ['G-ABCDEFGHIJKL', 'G-ABCDEFGHIJKL'],
    ])('returns true for %s', (_label, input) => {
      expect(isValidGtagId(input)).toBe(true)
    })
  })

  describe('invalid or missing IDs', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['whitespace', '   '],
      ['missing G- prefix', 'XXXXXXXXXX'],
      ['lower case prefix', 'g-XXXXXXXXXX'],
      ['GTM container id', 'GTM-XXXXXX'],
      ['UA legacy id', 'UA-123456-1'],
      ['too short', 'G-X'],
      ['contains hyphen', 'G-AB-CDEF'],
      ['contains lowercase', 'G-abcdef123'],
    ])('returns false for %s', (_label, input) => {
      expect(isValidGtagId(input)).toBe(false)
    })
  })
})

describe('isAnalyticsEnabled', () => {
  const VALID_ID = 'G-TEST123456'

  describe('production + valid id → enabled', () => {
    it('returns true when NODE_ENV is production and id is valid', () => {
      expect(
        isAnalyticsEnabled({ nodeEnv: 'production', gtagId: VALID_ID }),
      ).toBe(true)
    })
  })

  describe('non-production builds are always disabled', () => {
    it.each([
      ['development', 'development'],
      ['test', 'test'],
      ['staging', 'staging'],
      ['undefined', undefined],
      ['empty string', ''],
    ])('returns false when NODE_ENV=%s even with a valid id', (_label, env) => {
      expect(isAnalyticsEnabled({ nodeEnv: env, gtagId: VALID_ID })).toBe(false)
    })
  })

  describe('production builds without a valid id are disabled (fail-closed)', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['wrong prefix', 'GTM-ABCDEF'],
      ['UA id', 'UA-1234-5'],
    ])('returns false for gtagId=%s', (_label, id) => {
      expect(isAnalyticsEnabled({ nodeEnv: 'production', gtagId: id })).toBe(
        false,
      )
    })
  })
})
