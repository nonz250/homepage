import { expect, test } from '@playwright/test'

test.describe.skip('e2e smoke (enable after playwright install)', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Nozomi Hosaka/)
  })
})
