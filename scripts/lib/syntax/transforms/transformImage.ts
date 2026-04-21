import type { Image, Root } from 'mdast'
import { visit } from 'unist-util-visit'
import {
  CANONICAL_GITHUB_OWNER,
  CANONICAL_GITHUB_REPO,
  IMAGE_PATH_PATTERN,
  RAW_GITHUBUSERCONTENT_HOST,
} from '../../constants'

/**
 * 記事中の `/images/foo.png` 参照を `raw.githubusercontent.com` 経由の
 * 永続 URL に書き換える mdast transform。
 *
 * 用途:
 *   - Qiita 側で記事を配信する際、画像 URL は **絶対 URL** かつ外部ホスティング
 *     されている必要がある。本サイトではリポジトリ直下の `images/` 配下に
 *     画像を置いているため、commit SHA 付きの `raw.githubusercontent.com`
 *     URL に書き換えて参照させる。
 *
 * 契約:
 *   - 入力 `/images/<path>.ext` は `IMAGE_PATH_PATTERN` に合致する必要がある。
 *     path traversal (`..`) やディスアロード拡張子は reject (throw)。
 *   - 出力 URL:
 *     `https://<RAW_HOST>/<owner>/<repo>/<sha>/images/<path>.ext`
 *   - commit SHA は **純関数の引数** として受け取る (I/O 混入禁止)。
 *   - 既に絶対 URL や相対パス (`./`, `../`) の画像は素通し。
 *   - `data:` / `//protocol-relative` / `http:` 混入時は他 transform
 *     (`transformImagePathForQiita` や PR-B 以降) で検査するため、
 *     本 transform ではそれらを素通しする (責務分離)。
 */

/**
 * 対象とするローカル画像パスの接頭辞 (= `/images/` で始まる)。
 *
 * 厳密な allowlist は `IMAGE_PATH_PATTERN` で行うが、そもそも `/images/` で
 * 始まらない画像は書き換え対象外として素通しするために接頭辞チェックを
 * 先に行う。
 */
const LOCAL_IMAGE_PATH_PREFIX = '/images/'

/**
 * エラーメッセージの共通接頭辞。運用ログと単体テストで grep しやすくする。
 */
export const INVALID_LOCAL_IMAGE_PATH_ERROR_PREFIX =
  '[transformImage] invalid local image path:'

/**
 * transformImage のオプション。
 *
 * `commitSha` は画像 URL を永続化する基準となる git commit SHA。純関数契約
 * を守るため、呼び出し側で必ず解決してから渡す。
 */
export interface TransformImageOptions {
  readonly commitSha: string
  /**
   * オプショナル: owner/repo を差し替えるためのフック。default は
   * `CANONICAL_GITHUB_OWNER/REPO`。テストで他リポジトリを指す URL を生成
   * したい場合に上書きする。
   */
  readonly owner?: string
  readonly repo?: string
}

/**
 * 指定 SHA を基準に、`/images/...` ローカル画像パスを絶対 URL に書き換える。
 *
 * 副作用: image ノードの url フィールドを in-place で更新する。冪等性は
 * image url が既に絶対 URL の場合にスキップすることで担保される。
 */
export function transformImage(
  tree: Root,
  options: TransformImageOptions,
): void {
  const owner = options.owner ?? CANONICAL_GITHUB_OWNER
  const repo = options.repo ?? CANONICAL_GITHUB_REPO
  const sha = options.commitSha
  if (sha.length === 0) {
    throw new Error(
      `${INVALID_LOCAL_IMAGE_PATH_ERROR_PREFIX} commitSha must be a non-empty string`,
    )
  }
  visit(tree, 'image', (node: Image) => {
    const url = node.url
    if (typeof url !== 'string' || url.length === 0) {
      return
    }
    if (!url.startsWith(LOCAL_IMAGE_PATH_PREFIX)) {
      return
    }
    if (!IMAGE_PATH_PATTERN.test(url)) {
      throw new Error(`${INVALID_LOCAL_IMAGE_PATH_ERROR_PREFIX} ${url}`)
    }
    node.url = buildRawImageUrl(owner, repo, sha, url)
  })
}

/**
 * owner / repo / sha / local path から絶対 URL を組み立てる純関数。
 *
 * local path は `/images/...` で始まる想定。先頭スラッシュを剥がして
 * `${host}/${owner}/${repo}/${sha}${path}` に連結する (path は先頭スラッシュ
 * 込みでそのまま末尾に付ける)。
 */
function buildRawImageUrl(
  owner: string,
  repo: string,
  sha: string,
  localPath: string,
): string {
  return `https://${RAW_GITHUBUSERCONTENT_HOST}/${owner}/${repo}/${sha}${localPath}`
}
