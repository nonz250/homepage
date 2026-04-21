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
 *
 * `ArticleFrontmatter` は `content/schema/article.ts` の zod schema から
 * 派生した single source of truth であり、frontmatter 側を更新すれば
 * UI 層の型も追従する設計となっている。
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
 * `site` フラグが未指定のときに採用するデフォルト値。
 *
 * v4 で導入した配信フラグ。未指定時は「旧挙動と同じくサイト側に出す」ため
 * true に倒す。値が boolean 以外 (文字列等の壊れ frontmatter) でも安全側
 * (true) に寄せ、UI 側での消失を避ける (fail-safe)。
 */
const DEFAULT_SITE_VISIBILITY = true

/**
 * `toArticle` が受け入れる入力型。
 *
 * Nuxt Content v3 が返す `ArticlesCollectionItem` には index signature が
 * ないため、`Record<string, unknown>` 直受けでは TS2345 になる。かつ、
 * テストコードでは frontmatter フィールドを optional で渡したいため、
 * 既知フィールドだけを optional で受け付ける専用型を定義する。
 * 値の妥当性チェックはランタイムで行い、不正値は DTO のデフォルト値で
 * 吸収する (fail-open ではなく、未定義フィールドを安全なデフォルトに
 * 落とす形)。
 */
export interface ToArticleInput {
  readonly stem?: string
  readonly path?: string
  readonly title?: unknown
  readonly type?: unknown
  readonly topics?: unknown
  readonly published?: unknown
  readonly published_at?: unknown
  readonly emoji?: unknown
  /**
   * 本サイト配信フラグ (v4)。
   * 未指定時は {@link DEFAULT_SITE_VISIBILITY} に倒す。
   */
  readonly site?: unknown
}

/** `type` frontmatter のデフォルト値 */
const DEFAULT_ARTICLE_TYPE: Article['type'] = 'tech'

/** `type` frontmatter の受理可能値 */
const ARTICLE_TYPE_VALUES: ReadonlyArray<Article['type']> = ['tech', 'idea']

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
 * `site` フラグによるサイト上の可視性判定 (v4)。
 *
 * - `site` フィールドが真偽値で存在する場合はその値
 * - 未指定 (undefined) / 壊れた値 (string 等) の場合は
 *   {@link DEFAULT_SITE_VISIBILITY} に倒す
 *
 * `isArticleVisibleNow` と組み合わせて使う:
 *   - 記事一覧 (`useArticles`) や RSS (`/feed.xml`) は両方を満たすものだけ出す
 *   - preview モード時は本判定をスキップする呼び出し側の責務
 */
export function isArticleSiteVisible(item: {
  readonly site?: unknown
}): boolean {
  return coerceSiteVisibility(item.site)
}

/**
 * 未知の値を Article['type'] に正規化する。
 *
 * zod schema で `'tech' | 'idea'` に絞っているが、DB 側から取得する経路では
 * 型の保証がないためランタイム側でも narrow する。不明値は `tech` に倒す。
 */
function coerceArticleType(value: unknown): Article['type'] {
  return ARTICLE_TYPE_VALUES.includes(value as Article['type'])
    ? (value as Article['type'])
    : DEFAULT_ARTICLE_TYPE
}

/**
 * topics フィールドを安全に string[] に正規化する。
 */
function coerceTopics(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((v): v is string => typeof v === 'string')
}

/**
 * `site` フラグを boolean に正規化する。
 *
 * `true` / `false` の明示的な boolean のみ受理し、それ以外 (undefined, 文字列,
 * 数値など) は {@link DEFAULT_SITE_VISIBILITY} に倒す。
 *
 * fail-safe 方針: 壊れた frontmatter で site が誤った型になったとしても、
 * 既定値 (true) に寄せることで「既存記事が突然消える」事故を避ける。明確に
 * `site: false` が指定されたときだけ非表示にする。
 */
function coerceSiteVisibility(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  return DEFAULT_SITE_VISIBILITY
}

/**
 * Nuxt Content のレコードから UI 向け Article DTO に変換する純関数。
 *
 * `stem` を slug として採用し (Zenn 互換)、UI が扱いやすい形に正規化する。
 * 未知のフィールドは切り落とし、API 境界を安定化させる目的。
 */
export function toArticle(item: ToArticleInput): Article {
  const stem = typeof item.stem === 'string' ? item.stem : ''
  const path = typeof item.path === 'string' ? item.path : `/${stem}`
  return {
    slug: stem,
    path,
    title: typeof item.title === 'string' ? item.title : String(item.title ?? ''),
    type: coerceArticleType(item.type),
    topics: coerceTopics(item.topics),
    published: item.published === true,
    published_at:
      typeof item.published_at === 'string' ? item.published_at : undefined,
    emoji: typeof item.emoji === 'string' ? item.emoji : undefined,
    site: coerceSiteVisibility(item.site),
  }
}
