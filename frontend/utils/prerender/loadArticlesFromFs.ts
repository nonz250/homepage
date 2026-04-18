/**
 * ビルド時に記事ソースディレクトリ配下から Markdown ファイルを列挙し、
 * frontmatter をパースして prerender 判定用のメタ情報
 * (slug/published/published_at) を得るユーティリティ。
 *
 * Nuxt Content v3 の `queryCollection` はサーバーランタイム側 API であり、
 * Nuxt の build hook (nitro:config / prerender:routes) からは直接呼べない。
 * そこで ADR Phase 1 の合意に従い、build 時だけ gray-matter で frontmatter
 * を直接パースする fallback 方式を採用する。
 *
 * 入力は 1 ディレクトリでも、複数ディレクトリの配列でも受け付ける。
 * これは `articles/` (Zenn 共有) と `site-articles/` (本サイト限定) を同一
 * コレクションとして扱うための拡張 (ADR `site-only-articles.md` 参照)。
 *
 * 副作用: ファイルシステム読み込みあり。純関数である buildPrerenderRoutes と
 * 明確に分離し、I/O とビジネスロジックの責務を切り分ける。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, parse as parsePath } from 'node:path'
import matter from 'gray-matter'
import type { Article } from './buildPrerenderRoutes'

/** 記事として扱う拡張子 (Zenn Connect 互換) */
const MARKDOWN_EXTENSION = '.md'

/**
 * 指定した 1 つ以上のディレクトリ配下の Markdown から Article 配列を構築する。
 *
 * - slug はファイル名 (拡張子除く) を採用 (Zenn の慣習と同じ)
 * - published / published_at は frontmatter の値を読む。不正な型の場合は
 *   それぞれ安全な既定値 (published=false, published_at=undefined) に倒す
 * - frontmatter パース失敗や read error は呼び出し側 (build) で検知する
 *   ため、ここでは例外をそのまま伝播させる
 * - 存在しないディレクトリはスキップ (他のディレクトリがあれば処理を継続)
 *
 * @param articlesDirs 記事ディレクトリの絶対パス。単一文字列でも配列でも可
 * @returns Article 配列 (順序はディレクトリ列挙順 + 各ディレクトリ内の OS 列挙順)
 */
export function loadArticlesFromFs(
  articlesDirs: string | readonly string[],
): Article[] {
  const dirs = typeof articlesDirs === 'string' ? [articlesDirs] : articlesDirs
  const articles: Article[] = []
  for (const dir of dirs) {
    if (!directoryExists(dir)) continue
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith(MARKDOWN_EXTENSION)) continue
      const absPath = join(dir, entry.name)
      const raw = readFileSync(absPath, 'utf8')
      const { data } = matter(raw)
      const slug = parsePath(entry.name).name
      articles.push({
        slug,
        published: data.published === true,
        published_at:
          typeof data.published_at === 'string' ? data.published_at : undefined,
      })
    }
  }
  return articles
}

/** ディレクトリが存在するか確認する (存在しない環境でも build を止めない) */
function directoryExists(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
