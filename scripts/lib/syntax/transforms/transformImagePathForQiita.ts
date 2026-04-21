import type { Image, Root } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Zenn / GitHub 互換の画像サイズ指定 `![alt](URL =WxH)` を、Qiita では
 * render されないため除去する mdast transform。
 *
 * 背景:
 *   - Zenn 本家の Markdown 仕様では `![alt](URL =250x)` のように URL の
 *     後ろに空白区切りで `=<width>x<height>` を書くとサイズ指定できる。
 *     `=250x` / `=x200` / `=250x200` いずれも受理される。
 *   - Qiita はこの記法をサポートしていないため、そのまま出力すると
 *     image の url に `=250x` の文字列が残って正しく render されない。
 *
 * 実装:
 *   - remark-parse の image ノードは url と title を持つが、Zenn のサイズ
 *     記法は url の末尾にそのまま残ることが多い (= `=250x` を含む url)。
 *     本 transform は image.url に空白 + `=<digits>x<digits>?` が付いて
 *     いれば剥がす。title に入ってしまうケースも想定して `title` 側も
 *     チェックする。
 */

/**
 * url の末尾に残る Zenn サイズ指定を検出する regex。
 *
 *   - 先頭: 1 つ以上の空白 (`<space>` / `<tab>`)
 *   - `=` の直後に `<width>x<height>` の形 (両端いずれも省略可)
 *
 * 例: `https://...png =250x`, `https://...png =x200`, `https://...png =250x200`
 */
const ZENN_IMAGE_SIZE_IN_URL_PATTERN = /[ \t]+=\d*x\d*$/

/**
 * title として parse されるケース (`![](url "=250x")`) を検出する regex。
 * title 全体が "=WxH" のサイズ指定であれば削除する。
 */
const ZENN_IMAGE_SIZE_TITLE_PATTERN = /^=\d*x\d*$/

/**
 * url から Zenn のサイズ指定を剥がした新しい文字列を返す。
 */
function stripSizeSuffixFromUrl(url: string): string {
  return url.replace(ZENN_IMAGE_SIZE_IN_URL_PATTERN, '')
}

/**
 * mdast を走査し、image ノードから Zenn 固有のサイズ指定を剥がす。
 *
 * 副作用: image.url / image.title を in-place で更新する。冪等 (繰り返し
 * 適用してもサイズ指定が無ければ match しない)。
 */
export function transformImagePathForQiita(tree: Root): void {
  visit(tree, 'image', (node: Image) => {
    if (typeof node.url === 'string' && node.url.length > 0) {
      const stripped = stripSizeSuffixFromUrl(node.url)
      if (stripped !== node.url) {
        node.url = stripped
      }
    }
    if (typeof node.title === 'string' && ZENN_IMAGE_SIZE_TITLE_PATTERN.test(node.title)) {
      node.title = null
    }
  })
}
