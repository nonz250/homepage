/**
 * iframe 埋め込みサービス別のサンドボックス/allow/origin の単一ソース。
 *
 * Zenn 独自記法 `@[youtube]` / `@[codepen]` / `@[codesandbox]` / `@[stackblitz]`
 * の rehype 変換時に参照され、CSP (`frame-src`) 生成時にも origin 一覧として
 * 参照される。値の追加・変更は必ず本モジュールを起点に行い、設計 v4 の
 * 「iframe sandbox ホスト別ポリシー」表と整合させること。
 *
 * 各ポリシーは以下を厳格に宣言する:
 *   - `origin`: iframe src と CSP frame-src に使う https origin
 *   - `sandbox`: iframe の sandbox 属性値 (スペース区切りのフラグ列)
 *   - `allow`: iframe の allow 属性値 (機能ポリシー、必要ないサービスは空文字)
 *
 * 実装方針:
 *   - 読み取り専用 (`as const`) で公開し、呼び出し側での変更を防止
 *   - `getIframePolicy(service)` で安全に取得。未知の service は throw
 *   - `listIframeOrigins()` で origin 一覧を返し、CSP ヘッダー生成側が
 *     ハードコードせずに一元参照できるようにする
 */
import {
  CODEPEN_EMBED_ORIGIN,
  CODESANDBOX_EMBED_ORIGIN,
  STACKBLITZ_EMBED_ORIGIN,
  YOUTUBE_EMBED_ORIGIN,
} from '../constants/zenn-embed'

/**
 * サポートする埋め込みサービスの識別子。ここに列挙されていないサービスは
 * `getIframePolicy` で throw となり、未登録のホストへの iframe 生成を防ぐ。
 */
export type IframeService =
  | 'youtube'
  | 'codepen'
  | 'codesandbox'
  | 'stackblitz'

/**
 * iframe 1 件分のホストポリシー。`readonly` を徹底し、ポリシーテーブルが
 * 呼び出し側で書き換えられないよう型で保証する。
 */
export interface IframeHostPolicy {
  readonly service: IframeService
  readonly origin: string
  readonly sandbox: string
  readonly allow: string
}

/**
 * YouTube の sandbox フラグ。
 *
 * - `allow-scripts`: プレイヤー制御に必要
 * - `allow-same-origin`: cookie 無しとはいえ、プレイヤーが同一オリジンと
 *   して動作するために必要 (無しだと再生不可)
 * - `allow-presentation`: フルスクリーン再生のため
 */
const YOUTUBE_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation'

/**
 * YouTube の allow 属性。設計 v4 表に記載の最小セット。
 */
const YOUTUBE_ALLOW =
  'encrypted-media; picture-in-picture; fullscreen'

/**
 * CodePen / CodeSandbox / StackBlitz で共通の sandbox フラグ。
 *
 * いずれも埋め込み UI 内で以下が必要:
 *   - `allow-scripts`: コードエディタ・プレビュー実行
 *   - `allow-same-origin`: 内部 API 通信
 *   - `allow-forms`: リモート保存ボタン等の操作
 *   - `allow-popups`: 「Open in new tab」等のリンク挙動
 *
 * allow 属性は不要 (カメラ / マイク等の権限は使わない)。
 */
const CODE_SANDBOX_FLAGS =
  'allow-scripts allow-same-origin allow-forms allow-popups'

/**
 * ポリシーテーブル本体。`Record<IframeService, ...>` にしていないのは、
 * `as const` で immutable な構造化リテラルを保ちつつ `getIframePolicy`
 * 側で型安全な lookup を行うため。
 */
const IFRAME_HOST_POLICIES: Readonly<Record<IframeService, IframeHostPolicy>> = {
  youtube: {
    service: 'youtube',
    origin: YOUTUBE_EMBED_ORIGIN,
    sandbox: YOUTUBE_SANDBOX,
    allow: YOUTUBE_ALLOW,
  },
  codepen: {
    service: 'codepen',
    origin: CODEPEN_EMBED_ORIGIN,
    sandbox: CODE_SANDBOX_FLAGS,
    allow: '',
  },
  codesandbox: {
    service: 'codesandbox',
    origin: CODESANDBOX_EMBED_ORIGIN,
    sandbox: CODE_SANDBOX_FLAGS,
    allow: '',
  },
  stackblitz: {
    service: 'stackblitz',
    origin: STACKBLITZ_EMBED_ORIGIN,
    sandbox: CODE_SANDBOX_FLAGS,
    allow: '',
  },
} as const

/**
 * 登録済みの全サービス名。`listIframeOrigins` や単体テストでの網羅検証に使う。
 */
const REGISTERED_SERVICES: readonly IframeService[] = Object.freeze([
  'youtube',
  'codepen',
  'codesandbox',
  'stackblitz',
])

/**
 * 未知のサービス名が指定された場合のエラーメッセージ接頭辞。
 * 運用ログ / テストから grep しやすいよう文字列定数として公開する。
 */
export const UNKNOWN_IFRAME_SERVICE_ERROR_PREFIX =
  '[iframe-allowlist] unknown iframe service:'

/**
 * 指定した service の iframe ホストポリシーを返す。
 *
 * 未登録の service 名が渡された場合は throw。呼び出し側が catch せず
 * ビルド fail に導くことで、不正な埋め込みサービスの混入を早期に検知する。
 */
export function getIframePolicy(service: IframeService): IframeHostPolicy {
  const policy = IFRAME_HOST_POLICIES[service]
  if (policy === undefined) {
    throw new Error(`${UNKNOWN_IFRAME_SERVICE_ERROR_PREFIX} ${String(service)}`)
  }
  return policy
}

/**
 * 登録済み全サービスの origin を配列で返す。
 *
 * CSP ヘッダーの `frame-src` / `child-src` 生成側がこの値を参照して
 * 一元管理することで、origin の追加漏れを防ぐ。戻り値は `readonly`。
 */
export function listIframeOrigins(): readonly string[] {
  return REGISTERED_SERVICES.map((service) => IFRAME_HOST_POLICIES[service].origin)
}
