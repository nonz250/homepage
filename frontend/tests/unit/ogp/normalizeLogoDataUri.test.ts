/**
 * `utils/ogp/normalizeLogoDataUri.ts` のユニットテスト。
 */
import { describe, expect, it } from 'vitest'
import { normalizeLogoDataUri } from '../../../utils/ogp/normalizeLogoDataUri'

const VALID_PNG_DATA_URI = 'data:image/png;base64,AAAA'

describe('normalizeLogoDataUri', () => {
  it('returns null for undefined', () => {
    expect(normalizeLogoDataUri(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeLogoDataUri('')).toBeNull()
  })

  it('returns the input as-is for an allowed PNG data URI', () => {
    expect(normalizeLogoDataUri(VALID_PNG_DATA_URI)).toBe(VALID_PNG_DATA_URI)
  })

  it('throws for an unsupported data URI scheme (svg)', () => {
    expect(() =>
      normalizeLogoDataUri('data:image/svg+xml;base64,AAAA'),
    ).toThrowError(/prefix not allowed/)
  })

  it('throws for an unsupported data URI scheme (html)', () => {
    expect(() =>
      normalizeLogoDataUri('data:text/html;base64,AAAA'),
    ).toThrowError(/prefix not allowed/)
  })

  it('throws for plain http URL', () => {
    expect(() =>
      normalizeLogoDataUri('https://nozomi.bike/foo.png'),
    ).toThrowError(/prefix not allowed/)
  })
})
