/**
 * 記事個別ページに適用される OGP / Twitter Card メタの integration test。
 *
 * SFC (`pages/articles/[...slug].vue`) は Nuxt の auto-import (#imports,
 * useArticle, queryCollection 等) に依存しているため、happy-dom 単独で
 * SFC をマウントすると import 解決で失敗する。代わりに、SFC が呼び出す
 * 純関数 `buildArticleSeoMeta` の出力 (useHead に流す meta 配列) を検証
 * することで「記事ページの head に必要な meta が漏れなく流れている」
 * ことを境界レベルで保証する。
 *
 * 設計 v2 Step 14 の意図 (記事ページの head 検査) を、テスト安定性を
 * 保ちながら満たす経路として採用。
 */
import { describe, expect, it } from 'vitest'
import type { ArticleMetaEntry } from '../../../types/seo-meta'
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
const PRE_STYLE_PRIORITY = -8

const findByProperty = (
  meta: ArticleMetaEntry[],
  property: string,
): ArticleMetaEntry | undefined =>
  meta.find((entry) => entry.property === property)

const findByName = (
  meta: ArticleMetaEntry[],
  name: string,
): ArticleMetaEntry | undefined => meta.find((entry) => entry.name === name)

describe('buildArticleSeoMeta', () => {
  it('emits an absolute https URL for og:image', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    const ogImage = findByProperty(meta, 'og:image')
    expect(ogImage?.content).toMatch(/^https:\/\/.*\.png$/)
    expect(ogImage?.content).toBe(EXPECTED_OG_IMAGE_URL)
  })

  it('emits the canonical article URL with trailing slash', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(findByProperty(meta, 'og:url')?.content).toBe(EXPECTED_CANONICAL)
  })

  it('emits og:image dimensions and MIME type', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(findByProperty(meta, 'og:image:width')?.content).toBe(
      String(EXPECTED_OG_IMAGE_WIDTH),
    )
    expect(findByProperty(meta, 'og:image:height')?.content).toBe(
      String(EXPECTED_OG_IMAGE_HEIGHT),
    )
    expect(findByProperty(meta, 'og:image:type')?.content).toBe(
      EXPECTED_OG_IMAGE_TYPE,
    )
  })

  it('emits og:image:alt with article title and site name', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(findByProperty(meta, 'og:image:alt')?.content).toBe(
      EXPECTED_OG_IMAGE_ALT,
    )
  })

  it('emits twitter:card summary_large_image and matching image meta', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    expect(findByName(meta, 'twitter:card')?.content).toBe(
      'summary_large_image',
    )
    expect(findByName(meta, 'twitter:image')?.content).toBe(
      EXPECTED_OG_IMAGE_URL,
    )
    expect(findByName(meta, 'twitter:image:alt')?.content).toBe(
      EXPECTED_OG_IMAGE_ALT,
    )
    expect(findByName(meta, 'twitter:title')?.content).toBe(SAMPLE_INPUT.title)
    expect(findByName(meta, 'twitter:description')?.content).toBe(
      SAMPLE_INPUT.description,
    )
  })

  it('promotes Slack-critical tags above inline <style> via negative tagPriority', () => {
    const meta = buildArticleSeoMeta(SAMPLE_INPUT)
    const criticalSelectors: ReadonlyArray<{
      property?: string
      name?: string
    }> = [
      { property: 'og:title' },
      { property: 'og:image' },
      { property: 'og:description' },
      { property: 'og:url' },
      { property: 'og:type' },
      { name: 'twitter:image' },
      { name: 'description' },
    ]
    for (const selector of criticalSelectors) {
      const entry = selector.property
        ? findByProperty(meta, selector.property)
        : findByName(meta, selector.name ?? '')
      expect(entry?.tagPriority).toBe(PRE_STYLE_PRIORITY)
    }
  })

  it('falls back to default OGP image when slug shape is invalid', () => {
    const meta = buildArticleSeoMeta({
      ...SAMPLE_INPUT,
      slug: '../escape',
    })
    expect(findByProperty(meta, 'og:image')?.content).toBe(
      `${EXPECTED_BASE}/images/homepage-ogp.png`,
    )
  })
})
