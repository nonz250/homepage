/**
 * `runtimeConfig.public.baseUrl` がメタタグ生成に使える形になっているか
 * 静的検証する純関数。fail-closed のため、想定外の値は throw して build を
 * 即落とす。
 *
 * 検証項目:
 *   - https:// で始まる
 *   - URL.hostname が許可リスト (`ALLOWED_BASE_URL_HOSTS`) に含まれる
 *   - URL.pathname === '/' であり、search / hash を含まない (origin-only)
 *
 * production build (`isProduction` true) では localhost も弾く。
 * security-engineer の指摘 (設計 v2 Step 7-8 補足)。
 */
import { ALLOWED_BASE_URL_HOSTS } from '../../constants/seo'

/** production 時に許可するホストのみのリスト */
const PRODUCTION_ALLOWED_HOSTS: readonly string[] = ['nozomi.bike']

/**
 * `assertBaseUrl` の第 2 引数。
 */
export interface AssertBaseUrlOptions {
  /** production build かどうか。true なら localhost を弾く */
  readonly isProduction: boolean
}

/**
 * baseUrl の妥当性を検証し、不正値であれば throw する。
 */
export function assertBaseUrl(
  baseUrl: string,
  options: AssertBaseUrlOptions,
): void {
  if (!baseUrl.startsWith('https://')) {
    throw new Error(
      `[assertBaseUrl] baseUrl must start with "https://": received ${JSON.stringify(baseUrl)}`,
    )
  }
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error(
      `[assertBaseUrl] baseUrl is not a valid URL: ${JSON.stringify(baseUrl)}`,
    )
  }
  const allowedHosts: readonly string[] = options.isProduction
    ? PRODUCTION_ALLOWED_HOSTS
    : ALLOWED_BASE_URL_HOSTS
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new Error(
      `[assertBaseUrl] hostname not allowed: ${JSON.stringify(parsed.hostname)}` +
        ` (allowed: ${allowedHosts.join(', ')})`,
    )
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(
      `[assertBaseUrl] baseUrl must be origin-only (no path): ${JSON.stringify(baseUrl)}`,
    )
  }
  if (parsed.search.length > 0) {
    throw new Error(
      `[assertBaseUrl] baseUrl must not contain search params: ${JSON.stringify(baseUrl)}`,
    )
  }
  if (parsed.hash.length > 0) {
    throw new Error(
      `[assertBaseUrl] baseUrl must not contain hash: ${JSON.stringify(baseUrl)}`,
    )
  }
}
