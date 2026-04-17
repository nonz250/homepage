/**
 * 記事に関する型定義 + 公開状態判定の純関数群。
 *
 * composable (`useArticles` / `useArticle`) の双方から同一ロジックで
 * 判定することで、本番 / preview の境界に関する仕様の齟齬を防ぐ。
 * 純関数として単体テストも可能にしている。
 */
import type { ArticleFrontmatter } from '../../content/schema/article'

/**
 * アプリケーション内で扱う記事の最小形。
 *
 * Nuxt Content v3 の PageCollectionItem から UI が必要とする情報だけを
 * 取り出した DTO。`slug` は Zenn 互換でファイル名相当の値を持つ。
 */
export interface Article extends ArticleFrontmatter {
  /** 記事の URL パス部分 (例: "welcome") */
  readonly slug: string
  /** 記事のルーティング path (例: "/welcome") */
  readonly path: string
}

/** 公開判定に必要な最小フィールド (入力バリデーション用) */
interface VisibilityInput {
  published?: boolean
  published_at?: string
}

/**
 * 現在時刻 (ミリ秒) における記事の公開可視性を判定する。
 *
 * - `published !== true` は常に非公開
 * - `published_at` が undefined / 空文字なら「日付未指定・公開扱い」で true
 * - `published_at` が valid なら `nowMs` 以下で true
 * - `Date.parse` が NaN (不正な文字列) なら false (fail-closed)
 */
export function isArticleVisibleNow(
  item: VisibilityInput,
  nowMs: number,
): boolean {
  if (item.published !== true) {
    return false
  }
  if (typeof item.published_at !== 'string' || item.published_at === '') {
    return true
  }
  const publishedAtMs = Date.parse(item.published_at)
  if (Number.isNaN(publishedAtMs)) {
    return false
  }
  return publishedAtMs <= nowMs
}

/**
 * Nuxt Content のレコードから UI 向け Article DTO に変換する純関数。
 *
 * `stem` を slug として採用し (Zenn 互換)、UI が扱いやすい形に正規化する。
 * 未知のフィールドは切り落とし、API 境界を安定化させる目的。
 */
export function toArticle(
  item: Record<string, unknown> & { stem?: string; path?: string },
): Article {
  const stem = typeof item.stem === 'string' ? item.stem : ''
  const path = typeof item.path === 'string' ? item.path : `/${stem}`
  return {
    slug: stem,
    path,
    title: String(item.title ?? ''),
    type: (item.type as Article['type']) ?? 'tech',
    topics: Array.isArray(item.topics) ? (item.topics as string[]) : [],
    published: item.published === true,
    published_at:
      typeof item.published_at === 'string' ? item.published_at : undefined,
    emoji: typeof item.emoji === 'string' ? item.emoji : undefined,
  }
}
