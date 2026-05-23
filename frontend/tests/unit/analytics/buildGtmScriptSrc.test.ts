import { describe, expect, it } from 'vitest'
import { buildGtmScriptSrc } from '../../../utils/analytics/buildGtmScriptSrc'

/**
 * isValidGtmContainerId が事前検証する前提だが、任意文字が紛れた場合に
 * URL が破綻しないよう URLSearchParams で組む。
 */

describe('buildGtmScriptSrc', () => {
  it('builds the canonical gtm.js URL for a valid container id', () => {
    expect(buildGtmScriptSrc('GTM-ABCDEF')).toBe(
      'https://www.googletagmanager.com/gtm.js?id=GTM-ABCDEF',
    )
  })

  it('always uses the googletagmanager.com origin', () => {
    const url = buildGtmScriptSrc('GTM-ABCDEF')
    expect(url.startsWith('https://www.googletagmanager.com/gtm.js?')).toBe(
      true,
    )
  })

  it('URL-encodes the id query parameter', () => {
    const url = buildGtmScriptSrc('GTM-ABC&DEF=123')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('id')).toBe('GTM-ABC&DEF=123')
  })
})
