/**
 * Zenn 独自記法の埋め込み (YouTube / CodePen / CodeSandbox / StackBlitz / card)
 * に関する定数を集約するモジュール。
 *
 * 埋め込み ID のバリデーション正規表現、iframe 埋め込み時の origin (ホスト)、
 * iframe の共通属性値などをすべてここに named export としてまとめ、マジック
 * ナンバー/マジックストリングが各実装に散在するのを防ぐ。
 *
 * iframe sandbox / allow の値は設計 v4 の「iframe sandbox ホスト別ポリシー」
 * 表に基づき `config/iframe-allowlist.ts` で単一ソースとして定義する。
 * 本モジュールはバリデーションと CSP 用 origin のみを提供する。
 */
import { OGP_URL_MAX_LENGTH } from './ogp'

/**
 * YouTube の videoId フォーマット。
 *
 * YouTube video ID は 11 文字固定で、使用文字は英数字 / `_` / `-` のみ。
 * 例: `dQw4w9WgXcQ`。これ以外の形式はビルド時に fail させる。
 */
export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/**
 * YouTube 埋め込みの iframe src 生成に使う origin。
 *
 * プライバシー配慮のため nocookie ドメインを利用する。通常の
 * `www.youtube.com` は cookie を送出するためここでは採用しない。
 */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

/**
 * CodePen 埋め込み URL のパス部フォーマット。
 *
 * `<user>/pen/<id>` または `<user>/embed/<id>` の形式のみ許可する。
 * - user: 英数字 / `_` / `-` で 1〜32 文字
 * - id: 英数字のみで 1〜16 文字 (CodePen の pen ID 仕様)
 *
 * 公式仕様の厳密な文字種は公開されていないが、実在する値の観察と
 * CodePen のサブドメイン制約に合わせて最小限の範囲で許可する。
 */
export const CODEPEN_EMBED_PATH_PATTERN =
  /^[A-Za-z0-9_-]{1,32}\/(pen|embed)\/[A-Za-z0-9]{1,16}$/

/**
 * CodePen 埋め込みの iframe src 生成に使う origin。
 */
export const CODEPEN_EMBED_ORIGIN = 'https://codepen.io'

/**
 * CodeSandbox の sandbox ID フォーマット。
 *
 * CodeSandbox の sandbox ID は英数字 / `_` / `-` で最大 40 文字程度。
 * 公式の厳密な仕様は公開されていないため、文字種と長さを保守的に
 * 制限する。`s/<id>` 形式 (共有 URL のパス) も受け付けるかは本 pattern
 * では扱わず、validator 側で 2 形式を判定する。
 */
export const CODESANDBOX_EMBED_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/

/**
 * CodeSandbox 埋め込みの iframe src 生成に使う origin。
 */
export const CODESANDBOX_EMBED_ORIGIN = 'https://codesandbox.io'

/**
 * StackBlitz 埋め込み URL のパス部フォーマット。
 *
 * 以下の 2 形式のみ許可:
 *   - `edit/<project>`: 英数字 / `_` / `-` で 1〜60 文字
 *   - `github/<owner>/<repo>`: GitHub の owner/repo 形式
 *
 * 他の形式 (`/projects/...` や `/fork/...` 等) は本フェーズでは未サポート。
 */
export const STACKBLITZ_EMBED_PATH_PATTERN =
  /^(edit\/[A-Za-z0-9_-]{1,60}|github\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)$/

/**
 * StackBlitz 埋め込みの iframe src 生成に使う origin。
 */
export const STACKBLITZ_EMBED_ORIGIN = 'https://stackblitz.com'

/**
 * `@[card](URL)` に渡す URL の最小長 (空文字拒否用)。
 *
 * 空文字や空白のみの URL は build fail させ、静かに card が消えるのを防ぐ。
 */
export const CARD_URL_MIN_LENGTH = 1

/**
 * `@[card](URL)` に渡す URL の最大長。
 *
 * 検査の統一のため OGP 側 (`OGP_URL_MAX_LENGTH = 2048`) と同じ閾値を使う。
 * スキーム / ポート / IP 帯域検査は `utils/ogp/validateUrl.ts` の
 * `validateExternalUrl` + `resolveAndCheckDns` に委譲し、本定数では長さの
 * 上限のみを提示する。
 */
export const CARD_URL_MAX_LENGTH = OGP_URL_MAX_LENGTH

/**
 * iframe の `loading` 属性値。埋め込みはすべて lazy ロードする。
 *
 * 記事本文内の埋め込みは scroll されて初めて必要になるため、初期描画
 * コストを抑える意味でも lazy を一律採用する。
 */
export const IFRAME_LOADING_LAZY = 'lazy'

/**
 * iframe の `referrerpolicy` 属性値。
 *
 * クロスオリジン遷移時に path / query を含む Referer を送らないよう
 * `strict-origin-when-cross-origin` を採用する。これは主要ブラウザの
 * デフォルト値とも整合する。
 */
export const IFRAME_REFERRER_POLICY = 'strict-origin-when-cross-origin'

/**
 * Mermaid コードフェンスを識別する言語名。
 *
 * ` ```mermaid\n<DSL>\n``` ` の形式を `remarkZennMermaid` が検知し、
 * `<zenn-mermaid>` MDC コンポーネントに変換する。他の言語指定 (例: `js`,
 * `typescript`) はこのプラグインの対象外。
 */
export const MERMAID_CODE_LANGUAGE = 'mermaid'

/**
 * `mermaid.render` に渡す一意 ID の接頭辞。
 *
 * Mermaid は `render(id, code)` で渡された ID を内部 DOM の一時要素に付与する。
 * 同一ページ内で複数の図が共存しても ID 衝突しないよう、コンポーネント側で
 * この接頭辞 + ランダム suffix で ID を生成する。接頭辞を named 定数として
 * 切り出すことで、運用ログやテストでの絞り込みを容易にする。
 */
export const MERMAID_UNIQUE_ID_PREFIX = 'zenn-mermaid-'

/**
 * Twitter / X の Tweet ID フォーマット。
 *
 * Twitter の status ID は snowflake 由来の 64bit 整数だが、実表記は 10 進数
 * 文字列。過去の 10 桁 ID から最新の 19〜20 桁まで混在するため、余裕を
 * 持って 1〜25 桁の数字文字列を許容する。
 */
export const TWEET_ID_PATTERN = /^\d{1,25}$/

/**
 * Tweet URL に使われる公式ホスト集合。
 *
 * `twitter.com` (旧) と `x.com` (新) の両方、および `www.` サブドメイン付きを
 * 網羅する。モバイル向け `mobile.twitter.com` や `m.twitter.com` は実用上
 * 共有される頻度が低く、対応外とする。
 */
export const TWEET_URL_HOSTS = [
  'twitter.com',
  'x.com',
  'www.twitter.com',
  'www.x.com',
] as const

/**
 * Twitter 埋め込みで読み込む widgets.js の origin。
 *
 * CSP の `script-src` に許可する origin としても参照する (Batch D)。
 */
export const TWEET_EMBED_ORIGIN = 'https://platform.twitter.com'

/**
 * Twitter widgets.js の完全 URL。
 *
 * `ZennEmbedTweet.vue` が `onMounted` で `<script>` として動的挿入する。
 */
export const TWEET_WIDGETS_SCRIPT_URL =
  'https://platform.twitter.com/widgets.js'

/**
 * GitHub ユーザー名フォーマット。
 *
 * GitHub の仕様: 1〜39 文字、英数字 / ハイフン、先頭末尾はハイフン不可。
 * Gist オーナーもこの規則に従うため、Gist URL パス先頭の user セグメント
 * 検査にそのまま流用できる。
 */
export const GIST_USER_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/

/**
 * Gist ID フォーマット。
 *
 * Gist の hash は 20〜40 文字の小文字 16 進 (git object id 由来)。短縮 ID
 * (20 桁) も古い Gist では残っているため下限 20 まで許容する。
 */
export const GIST_ID_PATTERN = /^[a-f0-9]{20,40}$/

/**
 * Gist URL のホスト名。
 */
export const GIST_URL_HOST = 'gist.github.com'

/**
 * Gist 埋め込み script の origin。
 *
 * CSP の `script-src` に許可する origin としても参照する (Batch D)。
 */
export const GIST_EMBED_ORIGIN = 'https://gist.github.com'
