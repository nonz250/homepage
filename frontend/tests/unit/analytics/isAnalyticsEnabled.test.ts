import { describe, expect, it } from 'vitest'
import {
  isAnalyticsEnabled,
  isValidGtmContainerId,
} from '../../../utils/analytics/isAnalyticsEnabled'

/**
 * 本関数の真偽値が plugins/gtm.client.ts の <script> 読み込み分岐を決める。
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
