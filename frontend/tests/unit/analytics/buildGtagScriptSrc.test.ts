import { describe, expect, it } from 'vitest'
import { buildGtagScriptSrc } from '../../../utils/analytics/buildGtagScriptSrc'

/**
 * `buildGtagScriptSrc` の単体テスト。
 *
 * GA4 gtag.js の配信 URL を組み立てる純関数の契約を固定する:
 *   - origin / path 部分は固定 (www.googletagmanager.com/gtag/js)
 *   - `id` クエリは正しく URL エンコードされる
 *   - 呼び出し側は別途 `isValidGtagId` で形式検証する前提だが、
 *     空文字やエスケープ対象文字が渡っても URL が破綻しないこと
 */

describe('buildGtagScriptSrc', () => {
  it('builds the canonical gtag.js URL for a valid measurement id', () => {
    expect(buildGtagScriptSrc('G-TEST123456')).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123456',
    )
  })

  it('always uses the googletagmanager.com origin', () => {
    const url = buildGtagScriptSrc('G-ABCDEF1234')
    expect(url.startsWith('https://www.googletagmanager.com/gtag/js?')).toBe(
      true,
    )
  })

  it('URL-encodes the id query parameter', () => {
    const url = buildGtagScriptSrc('G-ABC&DEF=123')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('id')).toBe('G-ABC&DEF=123')
  })
})
