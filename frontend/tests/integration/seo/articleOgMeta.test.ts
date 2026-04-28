/**
 * 記事個別ページに適用される OGP / Twitter Card メタの integration test。
 *
 * SFC (`pages/articles/[...slug].vue`) は Nuxt の auto-import (#imports,
 * useArticle, queryCollection 等) に依存しているため、happy-dom 単独で
 * SFC をマウントすると import 解決で失敗する。代わりに、SFC が呼び出す
 * 純関数 `buildArticleSeoMeta` の出力を検証することで「記事ページの
 * head に必要な meta が漏れなく流れている」ことを境界レベルで保証する。
 *
 * 設計 v2 Step 14 の意図 (記事ページの head 検査) を、テスト安定性を
 * 保ちながら満たす経路として採用。
 */
import { describe, expect, it } from 'vitest'
import { buildArticleSeoMeta } from '../../../utils/seo/buildArticleSeoMeta'

const SAMPLE_INPUT = {
  slug: 'rust-saba',
  title: '鯖を読む技術',
  description: '鯖の読み方を解説する記事',
  baseUrl: 'https://nozomi.bike',
}

const EXPECTED_BASE = 'https://nozomi.bike'
const EXPECTED_OG_IMAGE_URL = `${EXPECTED_BASE}/ogp/${SAMPLE_INPUT.slug}.png`
const EXPECTED_CANONICAL = `${EXPECTED_BASE}/articles/${SAMPLE_INPUT.slug}/`
const EXPECTED_OG_IMAGE_ALT = `${SAMPLE_INPUT.title} - Nozomi Hosaka`
const EXPECTED_OG_IMAGE_TYPE = 'image/png'
const EXPECTED_OG_IMAGE_WIDTH = 1200
const EXPECTED_OG_IMAGE_HEIGHT = 630

describe('buildArticleSeoMeta', () => {
  it('emits an absolute https URL for og:image', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(meta.ogImage).toMatch(/^https:\/\/.*\.png$/)
    expect(meta.ogImage).toBe(EXPECTED_OG_IMAGE_URL)
  })

  it('emits the canonical article URL with trailing slash', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(meta.ogUrl).toBe(EXPECTED_CANONICAL)
  })

  it('emits og:image dimensions and MIME type', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(meta.ogImageWidth).toBe(EXPECTED_OG_IMAGE_WIDTH)
    expect(meta.ogImageHeight).toBe(EXPECTED_OG_IMAGE_HEIGHT)
    expect(meta.ogImageType).toBe(EXPECTED_OG_IMAGE_TYPE)
  })

  it('emits og:image:alt with article title and site name', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(meta.ogImageAlt).toBe(EXPECTED_OG_IMAGE_ALT)
  })

  it('emits twitter:card summary_large_image and matching image meta', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(meta.twitterCard).toBe('summary_large_image')
    expect(meta.twitterImage).toBe(EXPECTED_OG_IMAGE_URL)
    expect(meta.twitterImageAlt).toBe(EXPECTED_OG_IMAGE_ALT)
    expect(meta.twitterTitle).toBe(SAMPLE_INPUT.title)
    expect(meta.twitterDescription).toBe(SAMPLE_INPUT.description)
  })

  it('falls back to default OGP image when slug shape is invalid', () => {
    const meta = buildArticleSeoMeta({
      ...SAMPLE_INPUT,
      slug: '../escape',
    })
    // resolveArticleOgImagePath は invalid slug で DEFAULT_OG_IMAGE_PATH (png) を返す
    expect(meta.ogImage).toBe(`${EXPECTED_BASE}/images/homepage-ogp.png`)
  })
})
