/**
 * 複数のディレクトリから `.md` ファイルを列挙し、slug + 絶対パスを返す
 * ファイルシステム側ヘルパ。
 *
 * `detectSlugCollisions` は I/O を持たない純関数として定義しているため、
 * この関数で FS から入力を組み立て、純関数側へ渡す 2 段構成にしている。
 * 副作用の範囲を 1 ファイル内に閉じ込め、ビジネスロジックとテスト容易性を
 * 両立させることが目的。
 */
import { readdirSync, statSync } from 'node:fs'
import { join, parse as parsePath } from 'node:path'
import type { SlugSourceEntry } from './detectSlugCollisions'

/** 記事として扱う拡張子 (Zenn Connect 互換) */
const MARKDOWN_EXTENSION = '.md'

/**
 * 指定ディレクトリ群を走査し、各 `.md` ファイルから {slug, absPath} を集めて返す。
 *
 * - ディレクトリが存在しない場合はスキップ (空で続行)
 * - サブディレクトリは辿らない (フラット配置を前提)
 * - ファイル列挙順は OS 依存。`detectSlugCollisions` 側で slug 昇順に
 *   安定化するのでここでは並び替えない
 */
export function collectSlugEntriesFromDirs(
  dirs: readonly string[],
): SlugSourceEntry[] {
  const entries: SlugSourceEntry[] = []
  for (const dir of dirs) {
    if (!directoryExists(dir)) continue
    const dirents = readdirSync(dir, { withFileTypes: true })
    for (const dirent of dirents) {
      if (!dirent.isFile()) continue
      if (!dirent.name.endsWith(MARKDOWN_EXTENSION)) continue
      const absPath = join(dir, dirent.name)
      const slug = parsePath(dirent.name).name
      entries.push({ slug, absPath })
    }
  }
  return entries
}

/** ディレクトリが存在するか確認する (存在しない場合でもビルドを止めない) */
function directoryExists(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
