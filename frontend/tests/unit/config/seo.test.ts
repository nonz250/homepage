/**
 * `constants/seo.ts` の純関数テスト。
 *
 * - `resolveArticleOgImagePath` が正常な slug に対して `/ogp/<slug>.png` を返す
 * - 不正な slug (path traversal を含む文字列) に対しては fallback を返す
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OG_IMAGE_PATH,
  resolveArticleOgImagePath,
} from '../../../constants/seo'

describe('resolveArticleOgImagePath', () => {
  it('returns /ogp/<slug>.png for valid slugs', () => {
    expect(resolveArticleOgImagePath('hello')).toBe('/ogp/hello.png')
    expect(resolveArticleOgImagePath('phase-4-rss-ogp')).toBe(
      '/ogp/phase-4-rss-ogp.png',
    )
    expect(resolveArticleOgImagePath('a1b2_c3')).toBe('/ogp/a1b2_c3.png')
  })

  it('falls back to default on path-like or invalid slugs', () => {
    expect(resolveArticleOgImagePath('../etc/passwd')).toBe(
      DEFAULT_OG_IMAGE_PATH,
    )
    expect(resolveArticleOgImagePath('foo/bar')).toBe(DEFAULT_OG_IMAGE_PATH)
    expect(resolveArticleOgImagePath('Foo')).toBe(DEFAULT_OG_IMAGE_PATH)
    expect(resolveArticleOgImagePath('')).toBe(DEFAULT_OG_IMAGE_PATH)
    expect(resolveArticleOgImagePath('_starts-with-underscore')).toBe(
      DEFAULT_OG_IMAGE_PATH,
    )
  })
})
