const GTM_SCRIPT_ORIGIN = 'https://www.googletagmanager.com'
const GTM_SCRIPT_PATH = '/gtm.js'

/**
 * GTM コンテナ ID から gtm.js の script src URL を組み立てる純関数。
 *
 * 呼び出し側は事前に `isValidGtmContainerId` で形式検証する前提だが、
 * 任意文字が紛れた場合に URL が破綻しないよう URLSearchParams で組む。
 */
export function buildGtmScriptSrc(gtmId: string): string {
  const params = new URLSearchParams({ id: gtmId })
  return `${GTM_SCRIPT_ORIGIN}${GTM_SCRIPT_PATH}?${params.toString()}`
}
