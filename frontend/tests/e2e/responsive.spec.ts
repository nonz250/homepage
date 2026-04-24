import { expect, test } from '@playwright/test'

/**
 * モバイル幅でのレイアウト回帰を検知する E2E スモークテスト。
 *
 * Issue #57 対応: 主要ページで横スクロールが発生しないこと、および
 * ヘッダーから削除された "Blog" メニューが再復活していないことを
 * 確認する。contentsnippets (記事本文) は Phase 外。
 *
 * iPhone SE 相当の最狭 viewport (375px) を前提にアサーションする。
 */

const IPHONE_SE_VIEWPORT = { width: 375, height: 667 } as const

const MOBILE_PAGES = ['/', '/articles'] as const

test.describe('mobile layout regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(IPHONE_SE_VIEWPORT)
  })

  for (const path of MOBILE_PAGES) {
    test(`${path} does not overflow horizontally at iPhone SE width`, async ({
      page,
    }) => {
      const response = await page.goto(path)
      expect(response, 'navigation response should exist').not.toBeNull()
      expect(response!.status()).toBe(200)

      const overflow = await page.evaluate(() => {
        const scrollWidth = document.documentElement.scrollWidth
        const clientWidth = document.documentElement.clientWidth
        return { scrollWidth, clientWidth }
      })
      // 1px 程度のサブピクセル丸め誤差は許容する。
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
    })
  }

  test('/ header has no Blog entry', async ({ page }) => {
    await page.goto('/')
    // グローバルヘッダーは `.v-Header` クラスで一意。ArticleCard の
    // `<header class="card-header">` と衝突しないよう厳密に絞る。
    const header = page.locator('header.v-Header')
    await expect(header).toBeVisible()
    await expect(header).not.toContainText('Blog')
  })
})
