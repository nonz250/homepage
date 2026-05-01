/**
 * SEO / OGP メタタグ用に、相対パスとサイト baseUrl を結合して絶対 URL を組み立てる
 * 純関数。
 *
 * Slack や Twitter / X のクローラはメタタグの URL が絶対であることを期待するため、
 * `og:image` 等を `https://nozomi.bike/path/to/image.png` のような完全 URL にしないと
 * 「画像なし」状態でカードが unfurl される。本関数はその結合だけに責務を絞り、
 * 検証 (allowed host 等) は `assertBaseUrl` 側に分離する。
 *
 * 設計 v2 Step 7-8 を参照。
 */

/**
 * baseUrl と path を結合して絶対 URL を返す。
 *
 * - baseUrl は末尾の `/` を除去して扱う (重複スラッシュ防止)
 * - path は先頭が `/` であることを前提とし、そうでなければ throw する
 *   (`buildAbsoluteUrl(base, 'foo')` のような誤用を弾く意図)
 *
 * @param baseUrl 例: `https://nozomi.bike`
 * @param path 例: `/ogp/foo.png` (先頭スラッシュ必須)
 */
export function buildAbsoluteUrl(baseUrl: string, path: string): string {
  if (path.length === 0 || path[0] !== '/') {
    throw new Error(
      `[buildAbsoluteUrl] path must start with "/": received ${JSON.stringify(path)}`,
    )
  }
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${trimmedBase}${path}`
}
