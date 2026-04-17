#!/usr/bin/env node
/**
 * articles/*.md の frontmatter を走査し、下書き (published !== true)
 * の slug を改行区切りで標準出力に書き出すヘルパー。
 *
 * ビルド成果物スキャン (scripts/assert-no-drafts.sh) からシェル呼び出しで
 * 利用するため、依存は Node 標準と gray-matter のみに限定している。
 * side effects は「ファイル読み込み」と「標準出力への write」の 2 つのみ。
 *
 * 呼び出し方:
 *   node frontend/scripts/extract-draft-slugs.mjs [articles-dir]
 *     articles-dir のデフォルトはリポジトリ root 直下の `articles/`。
 *
 * 終了コード:
 *   0: 成功 (0 件ヒットでも 0)
 *   1: 読み込み or parse で失敗
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, parse as parsePath, resolve } from 'node:path'
import matter from 'gray-matter'

/** 記事として扱う拡張子 (Zenn Connect 互換) */
const MARKDOWN_EXTENSION = '.md'

/** 成功終了コード */
const EXIT_OK = 0
/** 失敗終了コード */
const EXIT_FAIL = 1

/**
 * articles ディレクトリ配下の Markdown から、published !== true な slug 群を
 * 純粋に抽出する関数。I/O はここに閉じ込める。
 */
function listDraftSlugs(articlesDir) {
  if (!directoryExists(articlesDir)) {
    return []
  }
  const entries = readdirSync(articlesDir, { withFileTypes: true })
  const drafts = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith(MARKDOWN_EXTENSION)) continue
    const absPath = join(articlesDir, entry.name)
    const raw = readFileSync(absPath, 'utf8')
    const { data } = matter(raw)
    if (data.published !== true) {
      drafts.push(parsePath(entry.name).name)
    }
  }
  return drafts
}

function directoryExists(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function resolveDefaultArticlesDir() {
  const here = dirname(fileURLToPath(import.meta.url))
  // frontend/scripts -> repo root /articles
  return resolve(here, '../../articles')
}

function main() {
  const argPath = process.argv[2]
  const articlesDir = argPath
    ? resolve(process.cwd(), argPath)
    : resolveDefaultArticlesDir()
  try {
    const slugs = listDraftSlugs(articlesDir)
    for (const slug of slugs) {
      process.stdout.write(`${slug}\n`)
    }
    process.exit(EXIT_OK)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`extract-draft-slugs: ${message}\n`)
    process.exit(EXIT_FAIL)
  }
}

main()
