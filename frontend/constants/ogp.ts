/**
 * OGP 取得処理に関する共通定数。
 *
 * SSRF / DoS / XSS 対策の閾値、キャッシュ TTL、許可スキーム / ポート / MIME を
 * 1 ファイルに集約する。マジックナンバー散在を避け、Phase 3 全体 (validateUrl /
 * httpClient / cache / sanitize / fetch) からの参照点を統一する。
 *
 * 注意: 値の意味を変更すると build 全体に影響するため、変更時は依存先 (utils/ogp/*)
 * を必ずあわせて確認すること。
 */

/**
 * 1 リクエストあたりの最大待機時間 (ms)。
 * 外部サイトが応答遅延・無限スピンする可能性があるため、generate 時間を
 * 守るためのハードリミット。
 */
export const OGP_FETCH_TIMEOUT_MS = 5000

/**
 * 1 レスポンスで読み込む最大バイト数。
 * 1 MB を超えるレスポンスは中断する。OGP 用 HTML がそんなに必要になることは
 * 通常ないため、メモリ消費爆発を防ぐ目的。
 */
export const OGP_FETCH_MAX_BYTES = 1_000_000

/**
 * リダイレクト追跡を許す最大ホップ数。
 * SSRF と無限ループの抑止。3 回までは Twitter -> t.co -> 実体リンクのような
 * 一般的なケースに耐えられる現実的な値。
 */
export const OGP_FETCH_MAX_REDIRECTS = 3

/**
 * OGP 取得時に提示する User-Agent。
 * 不審アクセスとして弾かれるのを避けるため、運用主体と連絡先を含めた識別文字列。
 */
export const OGP_USER_AGENT = 'nozomi.bike/ogp-fetcher (+https://nozomi.bike)'

/**
 * OGP キャッシュをファイルとして書き出すディレクトリ (リポジトリ root からの相対)。
 * generate 高速化と外部負荷低減のためのオフラインキャッシュ。
 */
export const OGP_CACHE_DIR = '.cache/ogp'

/**
 * 1 日あたりのミリ秒。TTL の組み立てに利用する補助定数。
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * OGP キャッシュの TTL (ms)。
 * 30 日: ブログのリンク先 OGP は頻繁に変わらない一方、長すぎると変更追従が
 * 鈍るため、月単位での再取得を許容する。
 */
export const OGP_CACHE_TTL_MS = 30 * MS_PER_DAY

/**
 * `og:title` を切り詰める最大文字数。
 * 表示崩れと payload 肥大化の抑止用。Twitter の表示慣習にもとづく。
 */
export const OGP_TITLE_MAX_LENGTH = 200

/**
 * `og:description` を切り詰める最大文字数。
 * 一覧の説明として使う限り 500 文字あれば十分という方針。
 */
export const OGP_DESCRIPTION_MAX_LENGTH = 500

/**
 * URL を許容する最大長 (文字数)。
 * 通常の OGP 取得には 2 KB あれば十分で、これを超える URL は SSRF/解析負荷の
 * 観点で拒否する。
 */
export const OGP_URL_MAX_LENGTH = 2048

/**
 * 取得対象 URL に許可するスキーム。
 * `file:`, `data:`, `gopher:` 等のローカル / 危険スキームを排除する。
 */
export const OGP_ALLOWED_SCHEMES = ['http:', 'https:'] as const

/**
 * 取得対象 URL に許可するポート番号。
 * 80 / 443 以外は管理用ポートや SSRF の標的になりうるため拒否する。
 */
export const OGP_ALLOWED_PORTS = [80, 443] as const

/**
 * `og:image` として許可する MIME 種別。
 * 一般的な静的画像のみを許す。SVG はスクリプト埋め込み余地があり除外。
 */
export const OGP_IMAGE_ALLOWED_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

/**
 * 自動生成する OGP PNG の画像幅 (px)。Twitter/Slack/Facebook のいずれの
 * カードでも 1200x630 が最も安全に表示されるためその値を採用する。
 *
 * 単一の真値として constants/ogp.ts に置き、Satori テンプレート / ラスタ
 * ライザ / メタタグ生成 (og:image:width / twitter image) の全てが本定数を
 * 参照する。設計 v2 Step 9。
 */
export const OGP_IMAGE_WIDTH = 1200

/**
 * 自動生成する OGP PNG の画像高さ (px)。
 */
export const OGP_IMAGE_HEIGHT = 630
