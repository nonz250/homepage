import { posix } from 'node:path'
import { IMAGE_PATH_PATTERN, IMAGES_DIR_NAME } from './constants'

/**
 * 画像パスの二重検証 (allowlist regex + path.normalize) を行う純関数。
 *
 * transformImage 側では IMAGE_PATH_PATTERN で regex 判定するが、本モジュールは
 * **別経路** で同じ路径を検証する fail-closed 多層防御。regex の盲点
 * (重スラッシュ / NUL / 末尾ドット / Unicode 正規化) を独立にチェックする。
 *
 * 受理条件 (いずれも満たす必要あり):
 *   1. `/images/` で始まること (posix 絶対パス)
 *   2. `..` / `./` / `//` / バックスラッシュ / NUL 等の危険シーケンスを含まない
 *   3. posix.normalize(path) が元のパスと一致 (= 冗長な区切りが無い)
 *   4. IMAGE_PATH_PATTERN (拡張子 allowlist) を満たす
 *
 * これらを分解して throw することで、運用時に "なぜ拒否されたか" が
 * エラーメッセージから判る。
 */

/**
 * throw 時のエラーメッセージ接頭辞。grep しやすい。
 */
export const INVALID_IMAGE_PATH_ERROR_PREFIX =
  '[assertSafeImagePath] invalid image path:'

/**
 * 許容する path prefix (= "/images/")。
 */
const REQUIRED_PREFIX = `/${IMAGES_DIR_NAME}/`

/**
 * 明示的に拒否する危険な部分文字列のリスト。
 *
 * regex のどこかに潜む可能性があるパターンを並べ、シンプルな substring 検査で
 * 早期に弾く。
 */
const FORBIDDEN_SUBSTRINGS = [
  '..',
  './',
  '//',
  '\\',
  '\u0000',
]

/**
 * 画像パスが **安全な相対 URL** (本リポジトリの /images/ 配下を指す) で
 * あることを検証する。違反があれば throw。
 */
export function assertSafeImagePath(path: string): void {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error(`${INVALID_IMAGE_PATH_ERROR_PREFIX} empty or non-string`)
  }
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    if (path.includes(forbidden)) {
      throw new Error(
        `${INVALID_IMAGE_PATH_ERROR_PREFIX} contains forbidden substring ${JSON.stringify(forbidden)}: ${path}`,
      )
    }
  }
  if (!path.startsWith(REQUIRED_PREFIX)) {
    throw new Error(
      `${INVALID_IMAGE_PATH_ERROR_PREFIX} must start with "${REQUIRED_PREFIX}": ${path}`,
    )
  }
  // path.posix.normalize は "/images/foo/../bar" を "/images/bar" に縮約する。
  // 正規化後に元と違えば冗長な区切りや traversal が含まれていた証拠。
  const normalized = posix.normalize(path)
  if (normalized !== path) {
    throw new Error(
      `${INVALID_IMAGE_PATH_ERROR_PREFIX} path not in canonical form (normalize=${normalized}): ${path}`,
    )
  }
  // 最終判定は既存の allowlist regex に委譲する (拡張子 + 文字種チェック)。
  if (!IMAGE_PATH_PATTERN.test(path)) {
    throw new Error(
      `${INVALID_IMAGE_PATH_ERROR_PREFIX} does not match allowlist: ${path}`,
    )
  }
}
