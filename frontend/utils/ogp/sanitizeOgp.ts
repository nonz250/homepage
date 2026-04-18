/**
 * OGP 抽出直後の生メタデータをサニタイズし、安全に表示できる `SafeOgp` に
 * 変換するモジュール。
 *
 * 攻撃面:
 *   - 任意 HTML / scrip タグ混入 → DOM 上で XSS の可能性
 *   - URL に `javascript:` / `data:` を入れたリンクで XSS
 *   - 巨大文字列の差し込みによる DOM 肥大化 / レイアウト破壊
 *
 * 対策:
 *   - 全文字列を `sanitize-html` で `allowedTags: []` / `allowedAttributes: {}`
 *     のままパスし、テキスト化 + HTML エンティティのデコードまで行う
 *   - URL / imageUrl は `validateExternalUrl` を再適用して `http(s):` 以外を排除
 *   - 各フィールドに最大長を強制し、超過時は切り詰める
 *
 * 設計選択:
 *   - 失敗を例外にせず、`SafeOgp` の各フィールドを `null` / 空文字に倒す方針。
 *     呼び出し側 (`fetchOgp`) で「`url` が空なら failure 扱い」と判定する。
 *   - サニタイズ結果は immutable な readonly オブジェクトとして返す。
 */
import sanitizeHtml from 'sanitize-html'
import {
  OGP_DESCRIPTION_MAX_LENGTH,
  OGP_TITLE_MAX_LENGTH,
  OGP_URL_MAX_LENGTH,
} from '../../constants/ogp'
import { validateExternalUrl } from './validateUrl'

/**
 * OGP 抽出器 (open-graph-scraper 等) から返ってきた生データの型。
 * 全フィールド optional で、欠損は呼出元の OGP メタが無いケースを表す。
 */
export interface RawOgp {
  readonly title?: string
  readonly description?: string
  readonly url?: string
  readonly imageUrl?: string
  readonly siteName?: string
}

/**
 * サニタイズ + 長さ制限後の安全なメタデータ。
 * - `url` は空文字を許容するが、その場合は呼出元で「不正」と判定する想定
 * - `imageUrl` / `siteName` は不正 / 欠損時 null
 */
export interface SafeOgp {
  readonly title: string
  readonly description: string
  readonly url: string
  readonly imageUrl: string | null
  readonly siteName: string | null
}

/**
 * `sanitize-html` の共通オプション。タグ / 属性を一切許容しないことで、
 * 入力 HTML を完全にテキストへ平坦化する。
 */
const TEXT_ONLY_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
}

/**
 * 文字列を「タグ除去 + エンティティ解釈 + trim」した上で max 文字に切り詰める。
 * `undefined` / 非文字列は空文字を返す。
 */
function sanitizeAndTruncate(raw: string | undefined, maxLength: number): string {
  if (typeof raw !== 'string') {
    return ''
  }
  const stripped = sanitizeHtml(raw, TEXT_ONLY_SANITIZE_OPTIONS).trim()
  if (stripped.length <= maxLength) {
    return stripped
  }
  return stripped.slice(0, maxLength)
}

/**
 * 外部 URL として安全か (= スキーム / ポート / 長さが許容内) を再検査し、
 * 通過すれば文字列を、失敗すれば null を返す。
 *
 * `imageUrl` / `url` 両方で使う共通処理。
 */
function sanitizeExternalUrl(raw: string | undefined): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > OGP_URL_MAX_LENGTH) {
    return null
  }
  const result = validateExternalUrl(trimmed)
  if (!result.ok) {
    return null
  }
  return trimmed
}

/**
 * 生 OGP を安全な `SafeOgp` に変換する純関数。
 * - サニタイズや長さ制限は内部で完結する
 * - URL 再検査もここで行うため呼出元は「最終的に安全である」と仮定して良い
 */
export function sanitizeOgp(raw: RawOgp): SafeOgp {
  const title = sanitizeAndTruncate(raw.title, OGP_TITLE_MAX_LENGTH)
  const description = sanitizeAndTruncate(raw.description, OGP_DESCRIPTION_MAX_LENGTH)
  const safeUrl = sanitizeExternalUrl(raw.url)
  const safeImageUrl = sanitizeExternalUrl(raw.imageUrl)
  const safeSiteName = (() => {
    if (typeof raw.siteName !== 'string') {
      return null
    }
    const cleaned = sanitizeAndTruncate(raw.siteName, OGP_TITLE_MAX_LENGTH)
    return cleaned.length === 0 ? null : cleaned
  })()
  return {
    title,
    description,
    url: safeUrl ?? '',
    imageUrl: safeImageUrl,
    siteName: safeSiteName,
  }
}
