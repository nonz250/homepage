import { describe, expect, it } from 'vitest'
import {
  isAnalyticsEnabled,
  isValidGtmContainerId,
} from '../../../utils/analytics/isAnalyticsEnabled'

/**
 * GTM 有効化判定 (`isAnalyticsEnabled`) の単体テスト。
 *
 * `plugins/gtm.client.ts` が本関数の真偽値に基づいて gtm.js の読み込みを
 * 分岐させるため、次を契約として固定する:
 *   - 本番ビルド (NODE_ENV=production) かつ有効な GTM container ID
 *     (`GTM-XXXXXX`) が渡されたときのみ true
 *   - 開発ビルドでは ID があっても false (ローカル開発で計測汚染しない)
 *   - ID 未設定 / 形式不正は本番ビルドでも false (fail-closed)
 *   - 前後空白や末尾改行は trim で吸収する (secret 由来の事故防止)
 */

describe('isValidGtmContainerId', () => {
  describe('valid GTM container IDs', () => {
    it.each([
      ['GTM-ABCDEF', 'GTM-ABCDEF'],
      ['GTM-123456', 'GTM-123456'],
      ['GTM-AB1234', 'GTM-AB1234'],
      ['GTM-ABCDEFGHIJ', 'GTM-ABCDEFGHIJ'],
      ['surrounding whitespace', '  GTM-ABCDEF  '],
      ['trailing newline (secret artifact)', 'GTM-ABCDEF\n'],
    ])('returns true for %s', (_label, input) => {
      expect(isValidGtmContainerId(input)).toBe(true)
    })
  })

  describe('invalid or missing IDs', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['whitespace only', '   '],
      ['missing GTM- prefix', 'ABCDEF'],
      ['lower case prefix', 'gtm-ABCDEF'],
      ['GA4 measurement id', 'G-ABCDEF1234'],
      ['UA legacy id', 'UA-123456-1'],
      ['too short', 'GTM-X'],
      ['contains hyphen in body', 'GTM-AB-CDEF'],
      ['contains lowercase in body', 'GTM-abcdef'],
    ])('returns false for %s', (_label, input) => {
      expect(isValidGtmContainerId(input)).toBe(false)
    })
  })
})

describe('isAnalyticsEnabled', () => {
  const VALID_ID = 'GTM-ABCDEF'

  describe('production + valid id → enabled', () => {
    it('returns true when NODE_ENV is production and id is valid', () => {
      expect(
        isAnalyticsEnabled({ nodeEnv: 'production', gtmId: VALID_ID }),
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
      expect(isAnalyticsEnabled({ nodeEnv: env, gtmId: VALID_ID })).toBe(false)
    })
  })

  describe('production builds without a valid id are disabled (fail-closed)', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['GA4 measurement id', 'G-ABCDEF1234'],
      ['UA id', 'UA-1234-5'],
    ])('returns false for gtmId=%s', (_label, id) => {
      expect(isAnalyticsEnabled({ nodeEnv: 'production', gtmId: id })).toBe(
        false,
      )
    })
  })
})
