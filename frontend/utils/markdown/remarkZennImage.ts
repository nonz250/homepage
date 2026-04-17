/**
 * Zenn Connect 互換の画像参照パスを Nuxt の公開アセットパスへ書き換える
 * remark プラグイン (Phase 1 最小版)。
 *
 * 記事中の `![](/images/foo.png)` のような参照は、Zenn では
 * `articles/images/foo.png` を指す相対参照として解釈される。一方、本サイトでは
 * `nitro.publicAssets` で `articles/images/` を `/articles-images/` に
 * マウントしているため、配信パスを差し替える必要がある。
 *
 * Phase 1 スコープ:
 *   - `/images/...` 形式のみ書き換える
 *   - `data:` / `//` / `http://` / `https://` / `..` / その他相対パスは
 *     素通し。`data:` は現時点では拒否せず、Phase 2 での sanitize 強化時に
 *     allow-list 化を検討する
 */
import { visit } from 'unist-util-visit'
import type { Root, Image } from 'mdast'
import {
  ARTICLES_IMAGES_PUBLIC_PATH,
  ARTICLES_IMAGES_SOURCE_PATH,
} from '../../constants/content-security'

/**
 * remark プラグイン本体。Nuxt Content v3 の markdown パイプラインから
 * `remarkPlugins` として渡される。
 *
 * 実装は mdast を走査して image ノードの `url` を検査し、
 * `ARTICLES_IMAGES_SOURCE_PATH` で始まる場合のみパス置換する。
 */
export default function remarkZennImage() {
  return (tree: Root): void => {
    visit(tree, 'image', (node: Image) => {
      if (shouldRewrite(node.url)) {
        node.url = rewriteImagePath(node.url)
      }
    })
  }
}

/**
 * URL を書き換え対象として扱うか判定する。
 *
 * `/images/` で始まり、かつ `//` (プロトコル相対) ではないものだけが対象。
 * それ以外 (絶対 URL、相対パス、data URL、空文字) は素通しする。
 */
function shouldRewrite(url: string | undefined | null): url is string {
  if (typeof url !== 'string' || url.length === 0) {
    return false
  }
  return url.startsWith(ARTICLES_IMAGES_SOURCE_PATH)
}

/**
 * `/images/foo.png` → `/articles-images/foo.png` への純粋な置換。
 *
 * 先頭の `ARTICLES_IMAGES_SOURCE_PATH` 分だけを剥がし、
 * `ARTICLES_IMAGES_PUBLIC_PATH` に連結する。クエリやフラグメントも
 * そのまま保持する (文字列操作のみで副作用なし)。
 */
function rewriteImagePath(url: string): string {
  return (
    ARTICLES_IMAGES_PUBLIC_PATH + url.slice(ARTICLES_IMAGES_SOURCE_PATH.length)
  )
}
