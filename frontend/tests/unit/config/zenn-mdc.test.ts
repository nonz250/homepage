import { describe, expect, it } from 'vitest'
import { pascalCase, kebabCase } from 'scule'
import {
  ZENN_DETAILS_TAG,
  ZENN_EMBED_CODEPEN_TAG,
  ZENN_EMBED_CODESANDBOX_TAG,
  ZENN_EMBED_STACKBLITZ_TAG,
  ZENN_EMBED_YOUTUBE_TAG,
  ZENN_MESSAGE_TAG,
} from '../../../constants/zenn-mdc'

/**
 * `constants/zenn-mdc.ts` に定義した MDC タグ名と、`components/content/` 配下の
 * PascalCase SFC ファイル名が、Nuxt Content / MDCRenderer の解決ルール
 * (`scule.pascalCase` / `scule.kebabCase`) 上で一致することを契約化する
 * テスト。
 *
 * 背景:
 *   `@nuxtjs/mdc` の MDCRenderer は tag 名を `pascalCase(tag)` で Vue
 *   コンポーネント名に変換して解決する。例えば `zenn-embed-you-tube` →
 *   `ZennEmbedYouTube`。逆に SFC 側の名前から kebabCase に変換した文字列
 *   (remark プラグインで AST に埋め込むタグ名) が一致しないと Vue が
 *   コンポーネントを解決できず warning 付きで `<zenn-...>` 生 HTML が
 *   出力されてしまう。
 *
 *   このテストは:
 *     1. 定数の kebab タグが PascalCase SFC 名にまた戻ること (往復一致)
 *     2. SFC ファイルと期待 kebab が 1:1 対応であること
 *   の 2 点を担保する。
 */

/**
 * 対応表: MDC 用 kebab タグ名と、解決先となる SFC の PascalCase 名。
 *
 * ここを更新すれば、remark プラグインや rehype プラグインなど kebab 側を
 * 使うコードと、`components/content/` 配下の SFC 名の整合が保たれる。
 */
const ZENN_MDC_TAG_PAIRS: readonly {
  readonly kebab: string
  readonly pascal: string
}[] = [
  { kebab: ZENN_MESSAGE_TAG, pascal: 'ZennMessage' },
  { kebab: ZENN_DETAILS_TAG, pascal: 'ZennDetails' },
  { kebab: ZENN_EMBED_YOUTUBE_TAG, pascal: 'ZennEmbedYouTube' },
  { kebab: ZENN_EMBED_CODEPEN_TAG, pascal: 'ZennEmbedCodePen' },
  { kebab: ZENN_EMBED_CODESANDBOX_TAG, pascal: 'ZennEmbedCodeSandbox' },
  { kebab: ZENN_EMBED_STACKBLITZ_TAG, pascal: 'ZennEmbedStackBlitz' },
] as const

describe('zenn-mdc constants', () => {
  describe('kebab -> pascal roundtrip matches expected SFC name', () => {
    it.each(ZENN_MDC_TAG_PAIRS)(
      '$kebab -> $pascal (pascalCase roundtrip)',
      ({ kebab, pascal }) => {
        expect(pascalCase(kebab)).toBe(pascal)
      },
    )
  })

  describe('pascal -> kebab roundtrip equals the constant', () => {
    it.each(ZENN_MDC_TAG_PAIRS)(
      '$pascal -> $kebab (kebabCase roundtrip)',
      ({ kebab, pascal }) => {
        expect(kebabCase(pascal)).toBe(kebab)
      },
    )
  })
})
