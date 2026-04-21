import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { assertWriteIntegrity } from '../yaml-safe-parse'

/**
 * 生成ファイル (articles/*.md, public/*.md) を書き込む I/O モジュール。
 *
 * 責務:
 *   - 出力先ディレクトリが無ければ mkdir -p
 *   - 書き込み **前** に assertWriteIntegrity で frontmatter 整合性を検査
 *     (書き込み後に読み直してもよいが、書き込みそのものが落ちたときに
 *      バックトレースを追いづらくなるため、同一 string を二重検証する)
 *   - writeFileSync で atomic に書く (Node.js 側でデフォルト atomic)
 *
 * expectedKeys は "このファイルが持つべき frontmatter" を独立検証するために
 * 呼び出し側から受け取る。例えば `ignorePublish: true` を強制したいなら
 * `expectedKeys.ignorePublish = 'true'` を渡す。
 */

/**
 * 期待する frontmatter キー値。FAILSAFE parse 経由で string/string[] 比較する
 * ため、受け入れ型は string / string[] に限定する。
 */
export type ExpectedFrontmatterKeys = Record<string, string | readonly string[]>

/**
 * 生成ファイルを書き出す。
 *
 * 処理順:
 *   1. assertWriteIntegrity(content, expectedKeys) で独立 re-parse 検証
 *      (書き込み前に失敗させる fail-closed 設計)
 *   2. mkdir -p
 *   3. writeFileSync
 */
export function writeArticleFile(
  filePath: string,
  content: string,
  expectedKeys: ExpectedFrontmatterKeys,
): void {
  assertWriteIntegrity(content, expectedKeys)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}
