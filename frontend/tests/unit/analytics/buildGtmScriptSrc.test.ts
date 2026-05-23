import { describe, expect, it } from 'vitest'
import { buildGtmScriptSrc } from '../../../utils/analytics/buildGtmScriptSrc'

/**
 * `buildGtmScriptSrc` の単体テスト。
 *
 * GTM gtm.js の配信 URL を組み立てる純関数の契約を固定する:
 *   - origin / path 部分は固定 (www.googletagmanager.com/gtm.js)
 *   - `id` クエリは正しく URL エンコードされる
 *   - 空文字やエスケープ対象文字が渡っても URL が破綻しないこと
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
