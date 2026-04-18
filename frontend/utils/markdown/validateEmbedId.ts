/**
 * Zenn 独自記法で使われる埋め込みサービス ID の静的バリデータ群。
 *
 * 各関数は純関数として入力文字列のみを検査し、正規表現 (constants/zenn-embed.ts)
 * と長さ/文字種の条件を満たしていれば `{ valid: true }`、満たさなければ
 * `{ valid: false, reason: '…' }` を返す。
 *
 * 方針:
 *   - 呼び出し側 (remark/rehype プラグイン) は `valid === false` を build fail
 *     の根拠として利用できるよう、`reason` を具体的な文字列にする
 *   - 例外を内部で握らない (副作用なしの純関数)。throw するかは呼び出し側の
 *     責務とする
 *   - 空文字や `null` / `undefined` も取り扱いを明確化するため、明示的な
 *     メッセージ付きで invalid を返す
 */
import {
  CARD_URL_MAX_LENGTH,
  CARD_URL_MIN_LENGTH,
  CODEPEN_EMBED_PATH_PATTERN,
  CODESANDBOX_EMBED_ID_PATTERN,
  GIST_ID_PATTERN,
  GIST_URL_HOST,
  GIST_USER_PATTERN,
  STACKBLITZ_EMBED_PATH_PATTERN,
  TWEET_ID_PATTERN,
  TWEET_URL_HOSTS,
  YOUTUBE_VIDEO_ID_PATTERN,
} from '../../constants/zenn-embed'
import { validateExternalUrl } from '../ogp/validateUrl'

/**
 * 埋め込み ID の検査結果。`valid` が false の場合は `reason` に原因を含める。
 */
export interface EmbedIdValidationResult {
  readonly valid: boolean
  readonly reason?: string
}

/**
 * 空値 (空文字 / 非文字列) の扱いを共通化するヘルパー。
 */
function createEmptyFailure(label: string): EmbedIdValidationResult {
  return {
    valid: false,
    reason: `${label} must be a non-empty string`,
  }
}

/**
 * pattern 不一致時のエラー理由を組み立てるヘルパー。原文字列と期待する
 * 正規表現の説明を添え、運用時にどこが不正か判別できるようにする。
 */
function createPatternFailure(
  label: string,
  raw: string,
  expectation: string,
): EmbedIdValidationResult {
  return {
    valid: false,
    reason: `${label} "${raw}" does not match expected format: ${expectation}`,
  }
}

/**
 * 入力が空または文字列以外なら failure を返し、それ以外なら `null` を返す。
 * 各バリデータ冒頭の nil チェックを共通化する目的で置く。
 */
function validateNonEmpty(
  raw: unknown,
  label: string,
): EmbedIdValidationResult | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return createEmptyFailure(label)
  }
  return null
}

/**
 * YouTube の videoId (11 文字固定、英数字 / `_` / `-`) を検査する。
 */
export function validateYouTubeVideoId(raw: string): EmbedIdValidationResult {
  const label = 'YouTube video ID'
  const nilFailure = validateNonEmpty(raw, label)
  if (nilFailure !== null) {
    return nilFailure
  }
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(raw)) {
    return createPatternFailure(
      label,
      raw,
      '11 characters of [A-Za-z0-9_-]',
    )
  }
  return { valid: true }
}

/**
 * CodePen 埋め込みのパス (`<user>/pen/<id>` or `<user>/embed/<id>`) を検査する。
 */
export function validateCodePenPath(raw: string): EmbedIdValidationResult {
  const label = 'CodePen embed path'
  const nilFailure = validateNonEmpty(raw, label)
  if (nilFailure !== null) {
    return nilFailure
  }
  if (!CODEPEN_EMBED_PATH_PATTERN.test(raw)) {
    return createPatternFailure(
      label,
      raw,
      '<user>/pen/<id> or <user>/embed/<id> where user=[A-Za-z0-9_-]{1,32}, id=[A-Za-z0-9]{1,16}',
    )
  }
  return { valid: true }
}

/**
 * CodeSandbox の sandbox 識別子を検査する。
 *
 * 2 形式を受け付ける:
 *   - `<id>`: 素の sandbox ID
 *   - `s/<id>`: 共有 URL のパス形式
 *
 * いずれも `<id>` 部は英数字 / `_` / `-` で 1〜40 文字。
 */
export function validateCodeSandboxId(raw: string): EmbedIdValidationResult {
  const label = 'CodeSandbox embed ID'
  const nilFailure = validateNonEmpty(raw, label)
  if (nilFailure !== null) {
    return nilFailure
  }
  const idCandidate = raw.startsWith('s/') ? raw.slice('s/'.length) : raw
  if (idCandidate.length === 0 || !CODESANDBOX_EMBED_ID_PATTERN.test(idCandidate)) {
    return createPatternFailure(
      label,
      raw,
      '<id> or s/<id> where id=[A-Za-z0-9_-]{1,40}',
    )
  }
  return { valid: true }
}

/**
 * StackBlitz 埋め込みのパス (`edit/<project>` or `github/<owner>/<repo>`) を
 * 検査する。
 */
export function validateStackBlitzPath(raw: string): EmbedIdValidationResult {
  const label = 'StackBlitz embed path'
  const nilFailure = validateNonEmpty(raw, label)
  if (nilFailure !== null) {
    return nilFailure
  }
  if (!STACKBLITZ_EMBED_PATH_PATTERN.test(raw)) {
    return createPatternFailure(
      label,
      raw,
      'edit/<project> (<=60 chars of [A-Za-z0-9_-]) or github/<owner>/<repo>',
    )
  }
  return { valid: true }
}

/**
 * Tweet / X URL の path セグメント (`/status/<id>`) から Tweet ID を抽出する。
 *
 * 受け付けるパターン:
 *   - `https://twitter.com/<user>/status/<id>`
 *   - `https://x.com/<user>/status/<id>`
 *   - `https://www.twitter.com/<user>/status/<id>`
 *   - `https://www.x.com/<user>/status/<id>`
 *
 * 追加クエリ / フラグメントは無視する。status ID は validator の pattern
 * (1〜25 桁の数字) に合致するもののみ返し、それ以外は null。
 *
 * 静的検査なので URL が parse 可能でない / host が allowlist 外 / status 形式
 * でない場合はすべて null を返す。build fail は呼び出し側 (remark プラグイン)
 * の責務とする。
 */
export function extractTweetId(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  }
  catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }
  if (!(TWEET_URL_HOSTS as readonly string[]).includes(parsed.hostname)) {
    return null
  }
  // path は `/<user>/status/<id>` または `/<user>/status/<id>/...`
  // segments を空要素除去しつつ分割。
  const segments = parsed.pathname.split('/').filter((s) => s.length > 0)
  const statusIndex = segments.indexOf('status')
  if (statusIndex < 0 || statusIndex + 1 >= segments.length) {
    return null
  }
  const idCandidate = segments[statusIndex + 1]
  if (!TWEET_ID_PATTERN.test(idCandidate)) {
    return null
  }
  return idCandidate
}

/**
 * Tweet / X URL を静的検査する。
 *
 * 抽出可能な Tweet ID があれば valid。それ以外 (host / path / id 形式不正) は
 * invalid として具体的な理由を返す。
 */
export function validateTweetUrl(raw: string): EmbedIdValidationResult {
  const label = 'Tweet URL'
  const nilFailure = validateNonEmpty(raw, label)
  if (nilFailure !== null) {
    return nilFailure
  }
  const id = extractTweetId(raw)
  if (id === null) {
    return createPatternFailure(
      label,
      raw,
      'https://(twitter.com|x.com)/<user>/status/<digits up to 25>',
    )
  }
  return { valid: true }
}

/**
 * Gist URL の path セグメント (`/<user>/<id>`) から user と id を抽出する。
 *
 * 受け付けるパターン:
 *   - `https://gist.github.com/<user>/<id>`
 *   - 末尾の revision (`/...`) や query / fragment は無視
 *
 * user は GitHub ユーザ名規則、id は 20〜40 文字の小文字 16 進。いずれかが
 * 欠けている / 形式違反なら null。
 */
export function extractGistUserId(
  raw: string,
): { readonly user: string; readonly id: string } | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  }
  catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }
  if (parsed.hostname !== GIST_URL_HOST) {
    return null
  }
  const segments = parsed.pathname.split('/').filter((s) => s.length > 0)
  if (segments.length < 2) {
    return null
  }
  const user = segments[0]
  const id = segments[1]
  if (!GIST_USER_PATTERN.test(user)) {
    return null
  }
  if (!GIST_ID_PATTERN.test(id)) {
    return null
  }
  return { user, id }
}

/**
 * Gist URL を静的検査する。
 *
 * 抽出可能な user/id があれば valid。それ以外は invalid 理由付きで返す。
 */
export function validateGistUrl(raw: string): EmbedIdValidationResult {
  const label = 'Gist URL'
  const nilFailure = validateNonEmpty(raw, label)
  if (nilFailure !== null) {
    return nilFailure
  }
  const extracted = extractGistUserId(raw)
  if (extracted === null) {
    return createPatternFailure(
      label,
      raw,
      'https://gist.github.com/<user>/<hex id 20-40 chars>',
    )
  }
  return { valid: true }
}

/**
 * `@[card](URL)` に渡す URL を検査する。
 *
 * 責務分担:
 *   - 本 validator: 空文字 / 長さ / スキーム / ポートの静的検査
 *   - SSRF / DNS リバインディング検査: ランタイム処理を伴うため、remark
 *     プラグイン側で `resolveAndCheckDns` を呼ぶ `fetchOgp` に委譲する
 *
 * 空値や長さ超過、`javascript:` / `data:` 等は build fail の根拠として扱う。
 * 成功時は `{ valid: true }` のみ返し、URL 文字列自体は呼出側で保持する。
 */
export function validateCardUrl(raw: string): EmbedIdValidationResult {
  const label = 'Zenn card URL'
  const nilFailure = validateNonEmpty(raw, label)
  if (nilFailure !== null) {
    return nilFailure
  }
  if (raw.length < CARD_URL_MIN_LENGTH) {
    return createEmptyFailure(label)
  }
  if (raw.length > CARD_URL_MAX_LENGTH) {
    return {
      valid: false,
      reason: `${label} "${raw.slice(0, 32)}..." exceeds max length ${CARD_URL_MAX_LENGTH}`,
    }
  }
  const external = validateExternalUrl(raw)
  if (!external.ok) {
    return createPatternFailure(
      label,
      raw,
      `absolute http(s) URL on port 80/443 (failed: ${external.reason ?? 'unknown'})`,
    )
  }
  return { valid: true }
}
