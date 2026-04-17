/**
 * 記事メタデータに関する定数を集約するモジュール。
 *
 * frontmatter のバリデーション (content schema)、記事一覧のページングなど、
 * Phase 1 Blog で参照される全ての上限値・閾値をここに集約する。マジック
 * ナンバーを避け、変更時の影響範囲を明確にする目的で名前付き定数として
 * 定義する。
 */

/** 記事タイトルの最小文字数 (空文字禁止) */
export const ARTICLE_TITLE_MIN_LENGTH = 1

/** 記事タイトルの最大文字数 (Zenn の慣習に合わせて 140 字) */
export const ARTICLE_TITLE_MAX_LENGTH = 140

/**
 * 記事 topic (タグ) のフォーマットを規定する正規表現。
 *
 * - 先頭は英小文字または数字
 * - 以降は英小文字・数字・ハイフンのみ
 * - 全体で 1〜32 文字
 *
 * これは Zenn のタグ仕様に揃えており、`-xxx` のようにハイフンで始まる値や
 * 大文字を含む値は拒否する。
 */
export const ARTICLE_TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

/** 1 記事あたりに設定可能な topic の最大数 */
export const ARTICLE_TOPIC_MAX_COUNT = 5

/** 記事一覧ページ 1 ページに表示する記事件数 */
export const ARTICLES_LIST_LIMIT = 20

/** index ページに「最新記事」として表示する件数 */
export const INDEX_LATEST_ARTICLES_LIMIT = 3
