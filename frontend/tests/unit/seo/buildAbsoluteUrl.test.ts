/**
 * `utils/seo/buildAbsoluteUrl.ts` のユニットテスト。
 */
import { describe, expect, it } from 'vitest'
import { buildAbsoluteUrl } from '../../../utils/seo/buildAbsoluteUrl'

describe('buildAbsoluteUrl', () => {
  it('joins origin and absolute path', () => {
    expect(buildAbsoluteUrl('https://nozomi.bike', '/ogp/foo.png')).toBe(
      'https://nozomi.bike/ogp/foo.png',
    )
  })

  it('removes trailing slash from baseUrl', () => {
    expect(buildAbsoluteUrl('https://nozomi.bike/', '/foo')).toBe(
      'https://nozomi.bike/foo',
    )
  })

  it('throws if path does not start with /', () => {
    expect(() => buildAbsoluteUrl('https://nozomi.bike', 'foo')).toThrowError(
      /must start with/,
    )
  })

  it('throws on empty path', () => {
    expect(() => buildAbsoluteUrl('https://nozomi.bike', '')).toThrowError(
      /must start with/,
    )
  })
})
