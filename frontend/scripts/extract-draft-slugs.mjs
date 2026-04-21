#!/usr/bin/env node
/**
 * 記事ソースディレクトリ (site-articles/) の frontmatter を走査し、
 * 下書き (published !== true) の slug を改行区切りで標準出力に書き出す
 * ヘルパー (v4)。
 *
 * v3 までは articles/ と site-articles/ の両方を走査していたが、v4 で
 * 記事の原典は site-articles/ に一本化された。articles/ は generator
 * (scripts/) が `site: true && zenn: true` の記事のみを出力するため、
 * `published: false` の記事が articles/ に存在しない前提 (二重防御不要)。
 *
 * ビルド成果物スキャン (scripts/assert-no-drafts.sh) からシェル呼び出しで
 * 利用するため、依存は Node 標準と gray-matter のみに限定している。
 * side effects は「ファイル読み込み」と「標準出力への write」の 2 つのみ。
 *
 * 呼び出し方:
 *   node frontend/scripts/extract-draft-slugs.mjs [...dirs]
 *     dirs のデフォルトはリポジトリ root 直下の site-articles/。
 *     1 つ以上のディレクトリを任意で渡すことができる (複数指定可)。
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
 * 与えられたディレクトリ集合配下の Markdown から、published !== true な
 * slug 群を純粋に抽出する関数。I/O はここに閉じ込める。
 *
 * - 存在しないディレクトリはスキップ (ビルドを止めない)
 * - slug 重複の除去は行わない (衝突検知は collectSlugEntriesFromDirs /
 *   detectSlugCollisions 側が build 時に fail させる役目を持つ)
 */
function listDraftSlugs(articlesDirs) {
  const drafts = []
  for (const dir of articlesDirs) {
    if (!directoryExists(dir)) continue
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith(MARKDOWN_EXTENSION)) continue
      const absPath = join(dir, entry.name)
      const raw = readFileSync(absPath, 'utf8')
      const { data } = matter(raw)
      if (data.published !== true) {
        drafts.push(parsePath(entry.name).name)
      }
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

function resolveDefaultArticlesDirs() {
  const here = dirname(fileURLToPath(import.meta.url))
  // frontend/scripts -> repo root /site-articles (v4: 原典は site-articles/ のみ)
  const repoRoot = resolve(here, '../..')
  return [resolve(repoRoot, 'site-articles')]
}

function main() {
  const argPaths = process.argv.slice(2)
  const articlesDirs =
    argPaths.length > 0
      ? argPaths.map((p) => resolve(process.cwd(), p))
      : resolveDefaultArticlesDirs()
  try {
    const slugs = listDraftSlugs(articlesDirs)
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
