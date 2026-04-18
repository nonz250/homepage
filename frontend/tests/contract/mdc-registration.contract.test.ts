import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * MDC コンポーネント登録の契約テスト。
 *
 * `@nuxt/content` は `components/content/` 配下に配置された Vue SFC を
 * 自動で MDC コンポーネントとして解決する。そのため本契約テストは:
 *
 *   1. 期待される Zenn 系コンポーネントが `components/content/` に存在する
 *   2. PascalCase の `.vue` ファイルとして配置されている
 *   3. 各ファイルが default export を持つ (dynamic import で確認)
 *
 * を検証する。登録先パスや命名規約が暗黙知にならないよう、変更があれば
 * 本テストで検知する。期待ファイル一覧は配列で宣言し、将来コンポーネントが
 * 増えたらここも更新する (契約テストとして意図的に静的)。
 */

/**
 * 契約として存在を要求する Zenn 系 MDC コンポーネントのファイル名。
 *
 * PascalCase を徹底し、`components/content/<FileName>.vue` で参照される。
 * MDC 記法上の要素名は kebab-case (`zenn-message` 等) で、Nuxt の解決で
 * 自動変換される。
 */
const EXPECTED_ZENN_COMPONENTS: readonly string[] = [
  'ZennMessage.vue',
  'ZennDetails.vue',
  'ZennEmbedYouTube.vue',
  'ZennEmbedCodePen.vue',
  'ZennEmbedCodeSandbox.vue',
  'ZennEmbedStackBlitz.vue',
  'ZennEmbedCard.vue',
  // Phase 3 Batch C1 で追加。 ```mermaid コードフェンスを SVG 描画する。
  'ZennMermaid.vue',
  // Phase 3 Batch C2 で追加。`@[tweet]` / `@[gist]` をクライアント描画する。
  'ZennEmbedTweet.vue',
  'ZennEmbedGist.vue',
] as const

/**
 * 許可する拡張子。MDC は Vue SFC 前提で `.vue` のみ受け付ける。
 */
const ALLOWED_EXTENSION = '.vue'

/**
 * PascalCase を検出するための単純な正規表現。
 *
 * - 1 文字目は大文字アルファベット
 * - 以降は英数字 (大文字小文字問わず) のみ
 * - アンダースコア / ハイフン / 先頭小文字を拒否
 */
const PASCAL_CASE_PATTERN = /^[A-Z][A-Za-z0-9]*$/

/**
 * `tests/contract` からの相対で `frontend/components/content/` を解決する。
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CONTENT_COMPONENTS_DIR = resolve(__dirname, '../../components/content')

/**
 * content ディレクトリ内の `.vue` ファイル一覧を返す。
 *
 * テスト内で複数回呼ばないよう、モジュールトップで 1 回だけ評価する。
 */
const contentFiles = readdirSync(CONTENT_COMPONENTS_DIR).filter((name) =>
  name.endsWith(ALLOWED_EXTENSION),
)

describe('MDC component registration contract', () => {
  describe('expected Zenn components exist', () => {
    it.each(EXPECTED_ZENN_COMPONENTS)(
      '%s is placed under components/content/',
      (fileName) => {
        expect(contentFiles).toContain(fileName)
      },
    )
  })

  describe('file naming convention', () => {
    it.each(EXPECTED_ZENN_COMPONENTS)(
      '%s uses PascalCase before the .vue extension',
      (fileName) => {
        const stem = fileName.replace(ALLOWED_EXTENSION, '')
        expect(stem).toMatch(PASCAL_CASE_PATTERN)
      },
    )
  })

  describe('no unexpected files in components/content/', () => {
    it('directory contains only the expected Zenn components', () => {
      // 将来 Zenn 系以外の MDC コンポーネント (例: Message.vue 等) を
      // 追加した場合、このテストは意図的に fail してレビュー時に気付けるようにする。
      const unexpected = contentFiles.filter(
        (name) => !EXPECTED_ZENN_COMPONENTS.includes(name),
      )
      expect(unexpected).toEqual([])
    })

    it('all files in components/content/ end with .vue', () => {
      const all = readdirSync(CONTENT_COMPONENTS_DIR)
      const nonVue = all.filter((name) => !name.endsWith(ALLOWED_EXTENSION))
      expect(nonVue).toEqual([])
    })
  })

  describe('each component has a default export', () => {
    it.each(EXPECTED_ZENN_COMPONENTS)(
      '%s exports a Vue component as default',
      async (fileName) => {
        // dynamic import で default export 存在を確認する。
        // Vue SFC は `@vitejs/plugin-vue` により object として読み込まれる。
        const modulePath = resolve(CONTENT_COMPONENTS_DIR, fileName)
        const mod = await import(modulePath)
        expect(mod.default).toBeTruthy()
        // Vue コンポーネント (SFC) は render 関数か setup 関数を持つ object。
        // 具体的 shape は Vue 内部仕様のため、object 型であることのみ確認する。
        expect(typeof mod.default).toBe('object')
      },
    )
  })
})
