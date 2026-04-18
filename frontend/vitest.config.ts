import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

/**
 * vitest の設定。
 *
 * Step 10 からは Vue SFC (components/parts/Article*.vue 等) を
 * happy-dom 上で直接 mount して検証するため、`@vitejs/plugin-vue` を
 * プラグインに追加する。SFC の `<style scoped lang="scss">` は SCSS
 * への `@use "assets/scss/..."` を含むため、vite の `css.preprocessorOptions`
 * に additionalData 的な注入は行わず、`resolve.alias` の `assets` だけで
 * sass に解決させる方針を採る。
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    // `.test.ts` は既存のテストケース、`.spec.ts` は Zenn ゴールデン比較など
    // 「仕様 / golden 検証」系のテストケース。Playwright e2e とファイル名が
    // 被らないよう、e2e 側は `tests/e2e/**` に隔離し exclude で外している。
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['utils/**/*.ts', 'constants/**/*.ts', 'app/**/*.ts', 'composables/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // SFC 内の `@use "assets/scss/..."` を sass から解決するため。
      'assets': fileURLToPath(new URL('./assets', import.meta.url)),
    },
  },
})
