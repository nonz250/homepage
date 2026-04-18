/**
 * Zenn 独自記法の埋め込み (YouTube / CodePen / CodeSandbox / StackBlitz) に関する
 * 定数を集約するモジュール。
 *
 * 埋め込み ID のバリデーション正規表現、iframe 埋め込み時の origin (ホスト)、
 * iframe の共通属性値などをすべてここに named export としてまとめ、マジック
 * ナンバー/マジックストリングが各実装に散在するのを防ぐ。
 *
 * iframe sandbox / allow の値は設計 v4 の「iframe sandbox ホスト別ポリシー」
 * 表に基づき `config/iframe-allowlist.ts` で単一ソースとして定義する。
 * 本モジュールはバリデーションと CSP 用 origin のみを提供する。
 */

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
