/**
 * Satori OGP 用フォントの subset 化に関する定数。
 *
 * - 旧 `frontend/scripts/subset-noto-sans-jp.mjs` で扱っていた
 *   FIXED_CHARACTERS / 出力フォーマット / ソースフォントパス を
 *   ビルド hook 側 (`buildOgpFontBuffer`) から再利用するためにここへ移植。
 * - 値の意味は旧スクリプトと同一。記事 frontmatter の title は実行時に
 *   合算するため、ここでは常に必要となる「英数字 + 日付関連 + 記号類」のみを
 *   並べる。
 *
 * 設計 v2 Step 3-4 / Step 6 を参照。
 */

/**
 * 必ず subset に含める文字集合。
 *
 * - 基本英数字: a-z A-Z 0-9
 * - 日付関連: 年月日時分秒 / ハイフン / コロン 等
 * - 記号類: # @ / . , ! ? : ; - _ ( ) [ ] < > 「」『』、。・ー
 * - 半角スペース
 * - HORIZONTAL ELLIPSIS (U+2026 …): Satori の `-webkit-line-clamp` で
 *   タイトルが 2 行を超えた際に末尾に挿入されるため、これが subset 外
 *   になると豆腐 (□) として描画される。要件 1 の根本対策の一部。
 *
 * 記事 frontmatter の title はビルド時に runtime 合算する。
 */
export const OGP_FONT_FIXED_CHARACTERS =
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '0123456789' +
  '年月日時分秒' +
  '#@/.,!?:;-_()[]<>' +
  '「」『』、。・ー' +
  ' ' +
  '…'

/**
 * subset-font に渡す target format。
 * Satori は WOFF2 を受け付けないため WOFF を採用する。
 */
export const OGP_FONT_TARGET_FORMAT = 'woff' as const

/**
 * ソースフォントの場所 (frontend/ ディレクトリからの相対パス)。
 *
 * `@fontsource/noto-sans-jp` の WOFF 版を直接読み込む。
 * caller は `path.resolve(__dirname, OGP_FONT_SOURCE_RELATIVE)` の
 * ような形でフルパスに展開して使う想定。
 */
export const OGP_FONT_SOURCE_RELATIVE =
  'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff'
