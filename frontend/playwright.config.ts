import { defineConfig, devices } from '@playwright/test'

const DEFAULT_PORT = 3000
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_BASE_URL = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`
const CI_RETRIES = 2
/** webServer 起動待ちの上限 (ミリ秒) */
const WEB_SERVER_TIMEOUT_MS = 120_000

/**
 * Playwright 設定。
 *
 * ビルド済み静的サイト (frontend/.output/public/) を http-server で配信し、
 * その URL に対してブラウザを当てる形で E2E を実行する。generate 成果物を
 * そのまま検査するため、CI での挙動と本番デプロイ成果物の挙動がずれない
 * ことを保証できる。
 *
 * 前提: 事前に `npm run generate` が成功し、.output/public/ が存在すること。
 * webServer は既に .output が無い場合は失敗するが、CI 側で generate を先に
 * 回すためこれを許容する。
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? CI_RETRIES : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // http-server は --silent で静音化、-a 127.0.0.1 で localhost にバインド。
        // -c-1 でキャッシュを無効化し、テスト間で古いレスポンスが返らないようにする。
        command: `npx http-server .output/public -p ${DEFAULT_PORT} -a ${DEFAULT_HOST} --silent -c-1`,
        url: DEFAULT_BASE_URL,
        timeout: WEB_SERVER_TIMEOUT_MS,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
