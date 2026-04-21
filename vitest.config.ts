import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * ルート直下の vitest 設定。
 *
 * PR-A ではスクリプト層 (`scripts/lib/`) のユニット/コントラクトテストを
 * `tests/` 配下に集約する。frontend/ 側には独自の vitest.config.ts が存在し、
 * そちらが Nuxt Content まわりの SFC テストを扱うため、本設定はあくまで
 * 「記事コンテンツパイプラインの純粋ロジック」を対象にする。
 *
 * - environment: node — DOM は不要 (AST 変換と schema のみ)
 * - include    : `tests/**\/*.{test,spec}.ts` — frontend/ 配下は見ない
 * - alias      : `@scripts/*` と `@tests/*` を tsconfig と合わせる
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['frontend/**', 'node_modules/**', 'dist-scripts/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['scripts/lib/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@scripts': fileURLToPath(new URL('./scripts', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
})
