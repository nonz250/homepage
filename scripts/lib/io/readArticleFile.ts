import { readFileSync, statSync } from 'node:fs'
import matter from 'gray-matter'
import {
  YAML_FILE_SIZE_LIMIT_BYTES,
  YAML_LINE_LIMIT,
} from '../constants'
import {
  articleFrontmatterSchema,
  type ArticleFrontmatter,
} from '../schema/article'

/**
 * 記事原典 (`site-articles/*.md`) を読み込む I/O モジュール。
 *
 * 責務:
 *   - ファイル読み込み (同期)
 *   - YAML bomb 対策 (size / 行数の上限チェック)
 *   - gray-matter による frontmatter / body 分離
 *   - articleFrontmatterSchema による zod 検証
 *
 * 純関数的な検査 (size check / line check) は `assertWithinYamlSafetyLimits`
 * に切り出して、io 経由で呼ぶ形にしている。ファイル読み込みは 1 回 (statSync +
 * readFileSync) のみ。
 */

/**
 * サイズ / 行数超過時のエラーメッセージ接頭辞。grep しやすい。
 */
export const YAML_BOMB_ERROR_PREFIX =
  '\\[readArticleFile\\] YAML safety limit exceeded'

/**
 * readArticleFile が返す構造。
 */
export interface ReadArticleResult {
  readonly path: string
  readonly frontmatter: ArticleFrontmatter
  readonly body: string
}

/**
 * YAML bomb 対策のセーフティリミットを検査する純関数。
 *
 * sizeBytes / lineCount は ("ファイル全体" ではなく) frontmatter の部分だけを
 * 対象にすると正確だが、frontmatter の境界判定は gray-matter に委ねる都合で
 * 先に判定できない。代わりに "ファイル全体が上限以下" を requirement とし、
 * 上限を大きめに取る (256 KiB / 5000 行) ことで運用影響を避ける。
 */
function assertWithinYamlSafetyLimits(
  filePath: string,
  sizeBytes: number,
  lineCount: number,
): void {
  if (sizeBytes > YAML_FILE_SIZE_LIMIT_BYTES) {
    throw new Error(
      `[readArticleFile] YAML safety limit exceeded: size ${sizeBytes} bytes > ${YAML_FILE_SIZE_LIMIT_BYTES}: ${filePath}`,
    )
  }
  if (lineCount > YAML_LINE_LIMIT) {
    throw new Error(
      `[readArticleFile] YAML safety limit exceeded: lines ${lineCount} > ${YAML_LINE_LIMIT}: ${filePath}`,
    )
  }
}

/**
 * 記事ファイルを読み込み、size/行数チェック → gray-matter → zod の順で検証する。
 *
 * @throws YAML safety limit 超過、gray-matter のパース失敗、schema 検証失敗。
 */
export function readArticleFile(filePath: string): ReadArticleResult {
  const stats = statSync(filePath)
  // 読み込み前にまずサイズをチェック (256 KiB 以下の通常ファイルのみ読む)。
  if (stats.size > YAML_FILE_SIZE_LIMIT_BYTES) {
    throw new Error(
      `[readArticleFile] YAML safety limit exceeded: size ${stats.size} bytes > ${YAML_FILE_SIZE_LIMIT_BYTES}: ${filePath}`,
    )
  }
  const raw = readFileSync(filePath, 'utf8')
  // 行数チェックは読み込み後。split の都合で末尾改行があれば 1 行ぶん多く数える
  // が、そもそも YAML_LINE_LIMIT は 5000 行と大きいため実害は無い。
  const lineCount = raw.split('\n').length
  assertWithinYamlSafetyLimits(filePath, raw.length, lineCount)

  const parsed = matter(raw)
  const validation = articleFrontmatterSchema.safeParse(parsed.data)
  if (!validation.success) {
    throw new Error(
      `[readArticleFile] frontmatter validation failed: ${filePath}\n${validation.error.message}`,
    )
  }
  return {
    path: filePath,
    frontmatter: validation.data,
    body: parsed.content,
  }
}
