/**
 * GA4 (gtag.js) の読み込み URL を組み立てる純関数。
 *
 * URL は `https://www.googletagmanager.com/gtag/js?id=<measurement_id>`
 * で固定。measurement ID を手作業で concatenation するとクエリ文字列の
 * エスケープ忘れ等でテストしづらいため、1 箇所の関数に集約して
 * 呼び出し元 (plugin) と検証 (unit test) で同じ実装を共有する。
 */

const GTAG_SCRIPT_ORIGIN = 'https://www.googletagmanager.com'
const GTAG_SCRIPT_PATH = '/gtag/js'

/**
 * GA4 測定 ID から gtag.js の script src URL を組み立てる。
 *
 * 呼び出し側は事前に `isValidGtagId` で形式検証を済ませている前提だが、
 * 万が一空文字が渡されたとしても URL が成立するよう `encodeURIComponent`
 * でエスケープする (実害はないが DRY のため)。
 */
export function buildGtagScriptSrc(gtagId: string): string {
  const params = new URLSearchParams({ id: gtagId })
  return `${GTAG_SCRIPT_ORIGIN}${GTAG_SCRIPT_PATH}?${params.toString()}`
}
