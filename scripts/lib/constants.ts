/**
 * 記事管理アーキテクチャ v4 で横断的に参照される定数群。
 *
 * マジックナンバー・マジックストリングの禁止原則に従い、変更時の影響範囲を
 * 明確化するためにパイプライン全体の constants をこのモジュールに集約する。
 *
 * 参考: frontend/constants/article.ts / frontend/constants/content-security.ts
 * と値が重複する箇所は、ESM/CJS 境界の都合により当面は複製を許容する。
 * frontend 側とは「どちらも原典から派生した値」であり、更新時には双方を
 * 同期する必要がある。詳細は `ARTICLE_TITLE_MAX_LENGTH` のコメント参照。
 */

// ============================================================================
// GitHub / リポジトリ識別
// ============================================================================

/**
 * 記事原典 (`site-articles/*.md`) が置かれている GitHub リポジトリのオーナー名。
 *
 * `raw.githubusercontent.com` 経由で Qiita 配信用に画像 URL を書き換える際、
 * commit SHA とあわせて permalink を組み立てるためのベース値。値は
 * `git remote get-url origin` の結果 (`git@github.com:nonz250/homepage.git`)
 * から取得した owner 部分と一致する。
 */
export const CANONICAL_GITHUB_OWNER = 'nonz250'

/**
 * 記事原典 (`site-articles/*.md`) が置かれている GitHub リポジトリ名。
 *
 * `CANONICAL_GITHUB_OWNER` と対で使用し、permalink 組み立て時の repo 部分。
 */
export const CANONICAL_GITHUB_REPO = 'homepage'

/**
 * `raw.githubusercontent.com` の配信ホスト。
 *
 * CDN 経路のない単純な raw ホスティング。commit SHA を含めた永続 URL を
 * 組み立てるための基底ドメイン。
 */
export const RAW_GITHUBUSERCONTENT_HOST = 'raw.githubusercontent.com'

// ============================================================================
// ディレクトリ名
// ============================================================================

/**
 * 記事原典 (単一情報源) が配置されているディレクトリ名。
 *
 * ここを起点に `articles/` (Zenn Connect 向け) と Qiita 向け成果物が
 * 生成される。
 */
export const SITE_ARTICLES_DIR_NAME = 'site-articles'

/**
 * Zenn Connect が取り込む記事 Markdown が配置されるディレクトリ名。
 *
 * `site-articles/` から生成される Zenn 専用の成果物置き場。
 */
export const ARTICLES_DIR_NAME = 'articles'

/**
 * 公開用静的アセットのルートディレクトリ名。
 *
 * Nuxt の `public/` と対を成すが、本プロジェクトではリポジトリルート直下の
 * `public/` を指す (画像配信経路の起点)。
 */
export const PUBLIC_DIR_NAME = 'public'

/**
 * 記事中で参照される画像アセットが置かれるディレクトリ名。
 *
 * `/images/foo.png` の形で参照される想定。リポジトリルート直下の `images/`
 * ディレクトリ。
 */
export const IMAGES_DIR_NAME = 'images'

// ============================================================================
// YAML / frontmatter パース時のセーフティ制限
// ============================================================================

/**
 * frontmatter として解析可能な YAML バイト数の上限。
 *
 * 256 KiB を超える frontmatter は想定利用を超過したサイズと見なし、
 * fail-closed で拒否する。過大サイズによる CPU/メモリ消費攻撃を防ぐ目的。
 */
export const YAML_FILE_SIZE_LIMIT_BYTES = 256 * 1024

/**
 * frontmatter として解析可能な最大行数。
 *
 * 極端に行数が多い YAML は手書き運用の想定を超えており、parser の内部状態を
 * 肥大化させる原因となりうる。5000 行を上限として fail-closed 運用する。
 */
export const YAML_LINE_LIMIT = 5000

// ============================================================================
// 記事 frontmatter の検証ルール
// ============================================================================

/**
 * 記事タイトルの最小文字数。空文字は禁止。
 *
 * frontend/constants/article.ts の `ARTICLE_TITLE_MIN_LENGTH` と同値 (1)。
 * frontend 側の値を変更する際は本定数も同期させること。
 */
export const ARTICLE_TITLE_MIN_LENGTH = 1

/**
 * 記事タイトルの最大文字数 (Zenn の慣習に合わせて 140 字)。
 *
 * frontend/constants/article.ts の `ARTICLE_TITLE_MAX_LENGTH` と同値。
 * frontend 側の値を変更する際は本定数も同期させること。
 */
export const ARTICLE_TITLE_MAX_LENGTH = 140

/**
 * 記事 topic (タグ) の形式を規定する正規表現。
 *
 * - 先頭は英小文字または数字
 * - 以降は英小文字・数字・ハイフンのみ
 * - 全体で 1〜32 文字
 *
 * frontend/constants/article.ts の `ARTICLE_TOPIC_PATTERN` と同一パターン。
 */
export const ARTICLE_TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

/**
 * 1 記事あたりに設定可能な topic の最大数。Zenn の慣習に合わせて 5。
 */
export const ARTICLE_TOPIC_MAX_COUNT = 5

/**
 * Zenn の slug (articles/<slug>.md のベース) として許容する形式。
 *
 * Zenn Connect の仕様:
 *   - 先頭は英小文字または数字
 *   - 以降は英小文字・数字・ハイフンのみ
 *   - 全体で 12〜50 文字
 *
 * 本 regex では "先頭 1 文字 + 11〜49 文字" で合計 12〜50 文字を保証する。
 */
export const ZENN_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{11,49}$/

// ============================================================================
// published_at に許容する文字列形式
// ============================================================================

/**
 * published_at で許容する 3 形式の正規表現。配列の順序は優先順位を意味しない
 * (いずれかに match すれば accept)。詳細は `scripts/lib/schema/publishedAt.ts`
 * を参照。
 *
 * 1. `YYYY-MM-DD HH:mm`             — Zenn Connect 現行フォーマット
 * 2. `YYYY-MM-DDTHH:mm:ss±HH:mm`    — ISO 8601 with numeric offset
 * 3. `YYYY-MM-DDTHH:mm:ssZ`         — ISO 8601 UTC
 */
export const PUBLISHED_AT_ZENN_LEGACY_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d$/

/**
 * published_at: ISO 8601 with numeric offset (例: `2026-04-19T21:00:00+09:00`).
 */
export const PUBLISHED_AT_ISO_OFFSET_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d[+-]([01]\d|2[0-3]):[0-5]\d$/

/**
 * published_at: ISO 8601 UTC (例: `2026-04-19T12:00:00Z`).
 */
export const PUBLISHED_AT_ISO_UTC_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/

// ============================================================================
// 画像パス allowlist
// ============================================================================

/**
 * 記事中で参照可能なローカル画像パスの allowlist 正規表現。
 *
 * - `/images/` 直下の相対パスのみ許容
 * - `..` (path traversal) を negative lookahead で拒否
 * - 拡張子は png / jpg / jpeg / gif / webp / svg に限定
 * - ファイル名に英数字・アンダースコア・ハイフン・スラッシュ・ドットのみ許容
 *
 * 将来的に日本語ファイル名対応を検討する余地はあるが、Qiita permalink への
 * URL エンコード問題 (半角スペースの扱い等) を回避するため、現時点では
 * ASCII safe の命名に限定する。
 */
export const IMAGE_PATH_PATTERN =
  /^\/images\/(?!.*\.\.)[A-Za-z0-9_\-./]+\.(png|jpg|jpeg|gif|webp|svg)$/

// ============================================================================
// Zenn 未対応記法 (fail-closed で reject する対象)
// ============================================================================

/**
 * Qiita 向けパイプラインで **対応不可** と判定し、ビルドを fail させる Zenn 記法。
 *
 * 配列の各要素は `@[<name>]` の `<name>` 部分。検出時は変換せず throw する
 * (`scripts/lib/syntax/rejectUnsupportedZennSyntax.ts` 参照)。
 *
 * - slideshare / speakerdeck / docswell / figma / blueprintue は Qiita では
 *   公式に対応するウィジェットが存在しないか、そのまま出すと崩れる。
 */
export const UNSUPPORTED_ZENN_EMBED_NAMES = [
  'slideshare',
  'speakerdeck',
  'docswell',
  'figma',
  'blueprintue',
] as const

/**
 * `@[<name>](...)` 形式を text+link の 2 連ノードから検出するために、link の
 * children 先行 text が末尾 `@` を持つかどうかの判定で参照するセンチネル。
 */
export const EMBED_DIRECTIVE_SENTINEL = '@'
