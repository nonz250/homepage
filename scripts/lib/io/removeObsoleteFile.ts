import { existsSync, rmSync, statSync } from 'node:fs'

/**
 * 既存の生成ファイルを削除する I/O モジュール。
 *
 * 主なユースケース:
 *   - 未来日付に戻された記事: public/<slug>.md を削除して公開を取り下げる
 *   - qiita:false に切り替えた記事: public/<slug>.md を削除
 *
 * 仕様:
 *   - ファイルが存在しない場合は no-op (冪等性)
 *   - ディレクトリが指定された場合は誤爆防止のため throw
 */

/**
 * 指定パスのファイルを削除する。存在しなければ no-op。
 *
 * @throws path が存在しディレクトリを指していた場合。
 */
export function removeObsoleteFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }
  const stats = statSync(filePath)
  if (!stats.isFile()) {
    throw new Error(
      `[removeObsoleteFile] refusing to remove non-file path: ${filePath}`,
    )
  }
  rmSync(filePath, { force: false })
}
