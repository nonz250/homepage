import { expect, test } from '@playwright/test'
import type { ConsoleMessage } from '@playwright/test'

/**
 * /articles 関連の E2E スモークテスト。
 *
 * 生成済みの静的サイト (frontend/.output/public/) を http-server で配信し、
 * 記事のコンテンツには依存しない範囲でページが動作することだけを確認する。
 * 具体的な記事タイトルや本文への依存は「記事を足した / 消した」たびに
 * テストが壊れるので、ここでは避ける。記事のレンダリング契約は unit test
 * (Markdown pipeline / MDC components) と build-artifact-scan で担保する。
 *
 * 検証観点:
 *   - `/articles` 一覧が 200
 *   - 存在しない記事 / タグが 404
 *   - console.error / warning が 0 (hydration warning 検知、allowlist 付き)
 */

/** 404 を期待する（prerender されない）slug のサンプル */
const MISSING_SLUGS = ['not-published', 'some-future-article'] as const

/** 存在しないタグ。404 を返すことを検証する。 */
const MISSING_TAGS = ['nonexistent', 'made-up-tag'] as const

/**
 * Nuxt 3 + SSG (http-server 配信) の組み合わせで恒常的に出る既知の warning。
 * 本来はフレームワーク側の挙動で、記事側の問題ではないので allowlist に入れる。
 * これ以外の warning/error が出たら実装由来として検知する。
 */
const KNOWN_HYDRATION_WARNINGS: readonly string[] = [
  'Hydration completed but contains mismatches.',
  "Allow attribute will take precedence over 'allowfullscreen'.",
  'GPU stall due to ReadPixels',
]

function collectConsoleIssues(page: import('@playwright/test').Page): string[] {
  const issues: string[] = []
  const isKnown = (text: string): boolean =>
    KNOWN_HYDRATION_WARNINGS.some((needle) => text.includes(needle))
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type()
    if (type !== 'error' && type !== 'warning') return
    const text = msg.text()
    if (isKnown(text)) return
    issues.push(`[${type}] ${text}`)
  })
  page.on('pageerror', (err: Error) => {
    if (isKnown(err.message)) return
    issues.push(`[pageerror] ${err.message}`)
  })
  return issues
}

test.describe('articles list page', () => {
  test('is served as 200 without console errors', async ({ page }) => {
    const issues = collectConsoleIssues(page)
    const response = await page.goto('/articles')
    expect(response, 'navigation response should exist').not.toBeNull()
    expect(response!.status()).toBe(200)
    await expect(page.locator('h1')).toContainText('Articles')
    expect(issues, 'no console errors or hydration warnings').toEqual([])
  })
})

test.describe('non-existent articles are not served', () => {
  for (const slug of MISSING_SLUGS) {
    test(`/articles/${slug} returns 404`, async ({ page }) => {
      const response = await page.goto(`/articles/${slug}`)
      expect(response).not.toBeNull()
      expect(response!.status()).toBe(404)
    })
  }
})

test.describe('tag pages', () => {
  for (const tag of MISSING_TAGS) {
    test(`/articles/tags/${tag} returns 404`, async ({ page }) => {
      const response = await page.goto(`/articles/tags/${tag}`)
      expect(response).not.toBeNull()
      expect(response!.status()).toBe(404)
    })
  }
})

test.describe('tags index JSON artifact', () => {
  test('/tags.json is served and parseable', async ({ request }) => {
    const response = await request.get('/tags.json')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(typeof body).toBe('object')
    expect(Array.isArray(body)).toBe(false)
  })
})
