import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * site-articles ディレクトリ配下の原典 Markdown を列挙する I/O モジュール。
 *
 * 責務:
 *   - 指定ディレクトリ直下 (1 階層) から `*.md` を抽出
 *   - 結果を lexicographic sort して return (generator の冪等性確保)
 *   - dotfile (.DS_Store 等) は除外
 *   - 拡張子が `.md` 以外のファイルも除外
 *   - nested directory は走査しない (原典は 1 ファイル 1 記事の flat 運用)
 */

/**
 * 走査対象とする拡張子。
 */
const ARTICLE_FILE_EXT = '.md'

/**
 * 指定ディレクトリ直下の Markdown ファイル絶対パス配列を返す。
 *
 * @throws ディレクトリが存在しない・読めない場合。
 */
export function listSourceArticles(dir: string): readonly string[] {
  const entries = readdirSync(dir)
  const results: string[] = []
  for (const name of entries) {
    if (name.startsWith('.')) {
      continue
    }
    if (!name.endsWith(ARTICLE_FILE_EXT)) {
      continue
    }
    const full = join(dir, name)
    const stats = statSync(full)
    if (!stats.isFile()) {
      continue
    }
    results.push(full)
  }
  // 決定性のため sorted で返す (generator の冪等性テストが前提)。
  results.sort()
  return results
}
