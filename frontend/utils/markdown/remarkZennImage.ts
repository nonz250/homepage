/**
 * Zenn Connect 互換の画像参照パスを Nuxt の公開アセットパスへ書き換える
 * remark プラグイン (Phase 1 最小版)。
 *
 * 記事中の `![](/images/foo.png)` のような参照は、Zenn CLI / Zenn Connect が
 * repo root 直下の `images/foo.png` を指す絶対パスとして解釈する。一方、
 * 本サイトでは `nitro.publicAssets` で root の `images/` を `/articles-images/`
 * に マウントしているため、配信パスを差し替える必要がある。
 *
 * Phase 1 スコープ:
 *   - `/images/...` (= `ARTICLES_IMAGES_SOURCE_PATH`) で始まる URL のみ書換
 *   - `data:` で始まる URL はビルドを fail させる (XSS / データ埋め込み防止)
 *   - `//` で始まる URL (プロトコル相対) はビルドを fail させる
 *     (bash スクリプト `assert-no-external-images.sh` と同じ契約)
 *   - `http://` / `https://` / `../` / `./` 等の相対パスは素通し
 *     (path traversal の厳格化は Phase 2 の sanitize 強化で扱う)
 */
import { visit } from 'unist-util-visit'
import type { Root, Image } from 'mdast'
import {
  ARTICLES_IMAGES_PUBLIC_PATH,
  ARTICLES_IMAGES_SOURCE_PATH,
} from '../../constants/content-security'

/**
 * ビルド fail の対象となる URL プレフィックス。
 * Nuxt Content の markdown パイプラインからビルド時に throw するため、
 * 攻撃者が混入させた危険な画像参照はデプロイ前に必ず検知される。
 */
const FORBIDDEN_URL_PREFIXES = ['data:', '//'] as const

/**
 * エラーメッセージ。テストや運用ログで同一トークンを検索できるよう
 * 定数化しておく。
 */
export const FORBIDDEN_IMAGE_URL_ERROR_PREFIX =
  '[remarkZennImage] forbidden image URL:'

/**
 * remark プラグイン本体。Nuxt Content v3 の markdown パイプラインから
 * `remarkPlugins` として渡される。
 *
 * 実装は mdast を走査して image ノードの `url` を検査し、
 * 禁止プレフィックスに該当すれば throw、`ARTICLES_IMAGES_SOURCE_PATH` で
 * 始まる場合のみパス置換する。
 */
export default function remarkZennImage() {
  return (tree: Root): void => {
    visit(tree, 'image', (node: Image) => {
      const url = node.url
      if (typeof url !== 'string' || url.length === 0) {
        return
      }
      assertNotForbidden(url)
      if (shouldRewrite(url)) {
        node.url = rewriteImagePath(url)
      }
    })
  }
}

/**
 * URL が禁止プレフィックスに該当する場合、説明的なエラーを throw する。
 *
 * `data:` と `//` はビルド時点で混入を拒否する契約。`data:` は記事
 * Markdown 中に base64 画像を直接埋め込まれるリスクを、`//` は
 * プロトコル相対 URL による外部ホスト読み込みを、それぞれブロックする。
 */
function assertNotForbidden(url: string): void {
  for (const prefix of FORBIDDEN_URL_PREFIXES) {
    if (url.startsWith(prefix)) {
      throw new Error(`${FORBIDDEN_IMAGE_URL_ERROR_PREFIX} ${url}`)
    }
  }
}

/**
 * URL を書き換え対象として扱うか判定する。
 *
 * `ARTICLES_IMAGES_SOURCE_PATH` (= `/images/`) で始まる URL のみ対象。
 * それ以外 (絶対 URL、相対パス、空文字) は素通しする。
 * 禁止プレフィックス (`data:` / `//`) は `assertNotForbidden` で事前に
 * 排除されているため、ここに到達する時点でいずれかの「安全な」形式である。
 */
function shouldRewrite(url: string): boolean {
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
