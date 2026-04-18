/**
 * Zenn 独自記法を MDC 記法に変換する際に使用する、MDC コンポーネントの
 * kebab-case タグ名を集約するモジュール。
 *
 * Nuxt Content v3 / `@nuxtjs/mdc` の `MDCRenderer` は、MDC 記法の tag 名を
 * `scule.pascalCase(tag)` で Vue コンポーネント名に解決する。そのため
 * kebab-case のタグ名は PascalCase の SFC ファイル名と 1:1 で対応しなければ
 * 描画に失敗する。
 *
 * 対応関係:
 *   - `ZennMessage.vue`              ⇄ `zenn-message`
 *   - `ZennDetails.vue`              ⇄ `zenn-details`
 *   - `ZennEmbedYouTube.vue`         ⇄ `zenn-embed-you-tube`
 *   - `ZennEmbedCodePen.vue`         ⇄ `zenn-embed-code-pen`
 *   - `ZennEmbedCodeSandbox.vue`     ⇄ `zenn-embed-code-sandbox`
 *   - `ZennEmbedStackBlitz.vue`      ⇄ `zenn-embed-stack-blitz`
 *
 * 注意: `scule.kebabCase('ZennEmbedYouTube')` は `zenn-embed-you-tube` を返す
 * (連続大文字 `YT` が `Y`+`T` の単語境界として分割される) 仕様のため、
 * SFC 名が `YouTube` と `Youtube` のどちらかで結果が変わる。本プロジェクトでは
 * `ZennEmbedYouTube` を採用しているため、対応 kebab は `zenn-embed-you-tube`
 * となる。
 */

/**
 * `:::message` コンテナ記法を変換した先の MDC コンポーネントタグ名。
 */
export const ZENN_MESSAGE_TAG = 'zenn-message'

/**
 * `:::details` コンテナ記法を変換した先の MDC コンポーネントタグ名。
 */
export const ZENN_DETAILS_TAG = 'zenn-details'

/**
 * `@[youtube]` 埋め込み記法を変換した先の MDC コンポーネントタグ名。
 *
 * `ZennEmbedYouTube.vue` の kebab-case 解決結果。`YouTube` の連続大文字は
 * `scule` の splitByCase で `You` + `Tube` に分割されるため、`youtube` では
 * なく `you-tube` になる点に注意。
 */
export const ZENN_EMBED_YOUTUBE_TAG = 'zenn-embed-you-tube'

/**
 * `@[codepen]` 埋め込み記法を変換した先の MDC コンポーネントタグ名。
 */
export const ZENN_EMBED_CODEPEN_TAG = 'zenn-embed-code-pen'

/**
 * `@[codesandbox]` 埋め込み記法を変換した先の MDC コンポーネントタグ名。
 */
export const ZENN_EMBED_CODESANDBOX_TAG = 'zenn-embed-code-sandbox'

/**
 * `@[stackblitz]` 埋め込み記法を変換した先の MDC コンポーネントタグ名。
 */
export const ZENN_EMBED_STACKBLITZ_TAG = 'zenn-embed-stack-blitz'
