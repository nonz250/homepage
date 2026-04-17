/**
 * ビルド時に `articles/` 配下から Markdown ファイルを列挙し、frontmatter を
 * パースして prerender 判定用のメタ情報 (slug/published/published_at) を得る
 * ユーティリティ。
 *
 * Nuxt Content v3 の `queryCollection` はサーバーランタイム側 API であり、
 * Nuxt の build hook (nitro:config / prerender:routes) からは直接呼べない。
 * そこで ADR Phase 1 の合意に従い、build 時だけ gray-matter で frontmatter
 * を直接パースする fallback 方式を採用する。
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
 * articles ディレクトリ配下の Markdown から Article 配列を構築する。
 *
 * - slug はファイル名 (拡張子除く) を採用 (Zenn の慣習と同じ)
 * - published / published_at は frontmatter の値を読む。不正な型の場合は
 *   それぞれ安全な既定値 (published=false, published_at=undefined) に倒す
 * - frontmatter パース失敗や read error は呼び出し側 (build) で検知する
 *   ため、ここでは例外をそのまま伝播させる
 *
 * @param articlesDir articles ディレクトリの絶対パス
 * @returns Article 配列 (順序はディレクトリ列挙順)
 */
export function loadArticlesFromFs(articlesDir: string): Article[] {
  if (!directoryExists(articlesDir)) {
    return []
  }
  const entries = readdirSync(articlesDir, { withFileTypes: true })
  const articles: Article[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith(MARKDOWN_EXTENSION)) continue
    const absPath = join(articlesDir, entry.name)
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
