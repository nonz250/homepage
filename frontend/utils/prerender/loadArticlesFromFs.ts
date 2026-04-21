/**
 * ビルド時に記事ソースディレクトリ配下から Markdown ファイルを列挙し、
 * frontmatter をパースして prerender 判定用のメタ情報
 * (slug/published/published_at/topics) を得るユーティリティ。
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
 * 戻り値は `Article` (prerender 用) と `TagIndexArticle` (タグ index 用)
 * の共通 superset を返す。両者とも構造的部分型として受け取れる。
 *
 * 副作用: ファイルシステム読み込みあり。純関数である buildPrerenderRoutes /
 * buildTagsIndex と明確に分離し、I/O とビジネスロジックの責務を切り分ける。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, parse as parsePath } from 'node:path'
import matter from 'gray-matter'
import type { Article } from './buildPrerenderRoutes'
import type { TagIndexArticle } from './buildTagsIndex'

/** 記事として扱う拡張子 (Zenn Connect 互換) */
const MARKDOWN_EXTENSION = '.md'

/**
 * frontmatter に `site` が指定されなかった / 壊れた値だった場合のデフォルト。
 *
 * v4 で追加した配信フラグ。既存記事を事故で消さないよう安全側 (true) に寄せる。
 * UI (composable) 側の `coerceSiteVisibility` と挙動を一致させている。
 */
const DEFAULT_SITE_FLAG_WHEN_MISSING = true

/**
 * `loadArticlesFromFs` の戻り値型。
 *
 * `Article` (prerender 判定) と `TagIndexArticle` (タグ index 構築) の
 * 共通 superset。呼び出し側は構造的部分型として扱える。
 *
 * Phase 4 で `title` フィールドを追加した。RSS フィード (`/feed.xml`) の
 * `<item><title>` に利用する。未指定 (frontmatter に `title` が無い) 場合は
 * 空文字となり、RSS の `<item>` 全体の整合はもはや保たない可能性があるため、
 * 利用側で必要なら空文字を弾くこと。
 */
export interface LoadedArticle extends Article, TagIndexArticle {
  readonly slug: string
  readonly title: string
  readonly published: boolean
  readonly published_at?: string
  readonly topics: readonly string[]
  /**
   * 記事に紐づく絵文字 (Zenn 記法の `emoji` frontmatter を踏襲)。
   * OGP 画像左上のアクセントとして利用される。未指定なら undefined。
   */
  readonly emoji?: string
  /**
   * 本サイトへの配信可否 (v4)。
   * frontmatter の `site` を boolean に正規化した値。未指定時は true
   * ({@link DEFAULT_SITE_FLAG_WHEN_MISSING}) に倒し、旧来の記事と同等に扱う。
   * RSS (`/feed.xml`) 等の build 時 I/O 経路で site:false を除外するために使う。
   */
  readonly site: boolean
}

/**
 * 指定した 1 つ以上のディレクトリ配下の Markdown から Article 配列を構築する。
 *
 * - slug はファイル名 (拡張子除く) を採用 (Zenn の慣習と同じ)
 * - published / published_at / topics は frontmatter の値を読む。不正な型の
 *   場合は安全な既定値 (published=false, published_at=undefined, topics=[])
 *   に倒す
 * - topics は配列内の string 要素のみ採用。non-string 要素は黙って除外
 * - frontmatter パース失敗や read error は呼び出し側 (build) で検知する
 *   ため、ここでは例外をそのまま伝播させる
 * - 存在しないディレクトリはスキップ (他のディレクトリがあれば処理を継続)
 *
 * @param articlesDirs 記事ディレクトリの絶対パス。単一文字列でも配列でも可
 * @returns LoadedArticle 配列 (順序はディレクトリ列挙順 + 各ディレクトリ内の OS 列挙順)
 */
export function loadArticlesFromFs(
  articlesDirs: string | readonly string[],
): LoadedArticle[] {
  const dirs = typeof articlesDirs === 'string' ? [articlesDirs] : articlesDirs
  const articles: LoadedArticle[] = []
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
        title: typeof data.title === 'string' ? data.title : '',
        published: data.published === true,
        published_at:
          typeof data.published_at === 'string' ? data.published_at : undefined,
        topics: coerceTopics(data.topics),
        emoji: typeof data.emoji === 'string' ? data.emoji : undefined,
        site:
          typeof data.site === 'boolean'
            ? data.site
            : DEFAULT_SITE_FLAG_WHEN_MISSING,
      })
    }
  }
  return articles
}

/**
 * frontmatter の `topics` フィールドを安全な `string[]` に正規化する。
 *
 * - 配列でなければ空配列
 * - 配列内は string 要素のみ採用 (non-string は除外)
 * - schema 側 (`content/schema/article.ts`) で pattern 検証は行われるが、
 *   FS から直接読む本関数は schema を通さないため、ここでも型の正規化だけは
 *   行う (fail-open ではなく、不正値は静かに落とす fail-safe)
 */
function coerceTopics(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((v): v is string => typeof v === 'string')
}

/** ディレクトリが存在するか確認する (存在しない環境でも build を止めない) */
function directoryExists(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
