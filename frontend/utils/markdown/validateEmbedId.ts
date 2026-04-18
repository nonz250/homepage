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
  CODEPEN_EMBED_PATH_PATTERN,
  CODESANDBOX_EMBED_ID_PATTERN,
  STACKBLITZ_EMBED_PATH_PATTERN,
  YOUTUBE_VIDEO_ID_PATTERN,
} from '../../constants/zenn-embed'

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
