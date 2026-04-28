/**
 * `utils/seo/assertBaseUrl.ts` のユニットテスト。
 */
import { describe, expect, it } from 'vitest'
import { assertBaseUrl } from '../../../utils/seo/assertBaseUrl'

describe('assertBaseUrl', () => {
  it('accepts https://nozomi.bike (production)', () => {
    expect(() =>
      assertBaseUrl('https://nozomi.bike', { isProduction: true }),
    ).not.toThrow()
  })

  it('accepts https://nozomi.bike (non-production)', () => {
    expect(() =>
      assertBaseUrl('https://nozomi.bike', { isProduction: false }),
    ).not.toThrow()
  })

  it('accepts trailing slash', () => {
    expect(() =>
      assertBaseUrl('https://nozomi.bike/', { isProduction: true }),
    ).not.toThrow()
  })

  it('accepts https://localhost in non-production', () => {
    expect(() =>
      assertBaseUrl('https://localhost', { isProduction: false }),
    ).not.toThrow()
  })

  it('rejects https://localhost in production', () => {
    expect(() =>
      assertBaseUrl('https://localhost', { isProduction: true }),
    ).toThrowError(/hostname not allowed/)
  })

  it('rejects http://nozomi.bike (non-https)', () => {
    expect(() =>
      assertBaseUrl('http://nozomi.bike', { isProduction: true }),
    ).toThrowError(/start with "https/)
  })

  it('rejects unknown hostname even in non-production', () => {
    expect(() =>
      assertBaseUrl('https://example.com', { isProduction: false }),
    ).toThrowError(/hostname not allowed/)
  })

  it('rejects baseUrl with path', () => {
    expect(() =>
      assertBaseUrl('https://nozomi.bike/foo', { isProduction: true }),
    ).toThrowError(/origin-only/)
  })

  it('rejects baseUrl with search params', () => {
    expect(() =>
      assertBaseUrl('https://nozomi.bike/?x=1', { isProduction: true }),
    ).toThrowError(/(origin-only|search params)/)
  })

  it('rejects baseUrl with hash', () => {
    expect(() =>
      assertBaseUrl('https://nozomi.bike/#a', { isProduction: true }),
    ).toThrowError(/(origin-only|hash)/)
  })

  it('rejects malformed URL', () => {
    expect(() =>
      assertBaseUrl('https://', { isProduction: false }),
    ).toThrowError()
  })
})
