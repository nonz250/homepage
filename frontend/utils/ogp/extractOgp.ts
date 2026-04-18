/**
 * `open-graph-scraper` を薄く包み、HTML 文字列から OGP メタタグを抽出して
 * 内部共通の `RawOgp` 形に落とす抽出器。
 *
 * 役割:
 *   - Layer 2 (`HttpClient`) が取得済みの HTML をそのまま受け取り、`ogs()` に
 *     `{ html, url }` の形で渡す。`ogs` 内の fetch は発動させない。
 *   - og:* を最優先、twitter:* を fallback として値を取り出し、1 件の
 *     `RawOgp` にまとめる。
 *   - 例外や抽出失敗は throw ではなく空 `RawOgp` + base URL を返す。`fetchOgp`
 *     は戻った `RawOgp` を `sanitizeOgp` に通し、`url` が空なら failure 判定
 *     する設計なので、ここで例外まで伝搬させない方が上位の分岐を単純化できる。
 *
 * 設計選択:
 *   - `open-graph-scraper` の戻り値型 (`OgObject`) は多くのフィールドを持ち、
 *     `ogImage` / `twitterImage` は配列。本モジュールはそのうち必要フィールド
 *     のみを取り出して `RawOgp` に合わせる。
 *   - 型が any 気味の箇所には小さな type guard (`isNonEmptyString`,
 *     `firstImageUrl`) を置き、unknown の narrow を局所化する。
 */
import ogs from 'open-graph-scraper'
import type { RawOgp } from './sanitizeOgp'

/**
 * `open-graph-scraper` が返す `ogImage` / `twitterImage` 要素の共通形。
 *
 * 公式型は `ImageObject` / `TwitterImageObject` に分かれるが、本モジュール
 * では `url` だけ使うため union を narrow する用途で独自の最小型を用意する。
 */
interface ImageLike {
  readonly url?: unknown
}

/**
 * 値が空でない文字列であるかを判定する type guard。
 * `open-graph-scraper` の戻り値フィールド型は実際には `string | undefined` が
 * 多いが、安全側に倒して unknown から narrow する。
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * `ogImage` / `twitterImage` 等の画像配列から先頭の `url` を取り出す。
 *   - 配列が空・`url` が非文字列・配列以外の場合は undefined を返す
 *
 * 取り出した URL はまだ検証しておらず、後段の `sanitizeOgp` で
 * `validateExternalUrl` による scheme / 長さ検証が行われる想定。
 */
function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images)) {
    return undefined
  }
  for (const entry of images as readonly ImageLike[]) {
    const url = entry?.url
    if (isNonEmptyString(url)) {
      return url
    }
  }
  return undefined
}

/**
 * 与えられた HTML と base URL から OGP を抽出する。
 *
 * `ogs` は `{ html }` と `{ url }` のどちらか一方のみ指定可能な仕様のため、
 * Layer 2 (HttpClient) が取得済み HTML を渡すケースでは `html` のみを指定
 * する。base URL は og:url が欠損している場合のフォールバック用に保持し、
 * `RawOgp.url` に埋める。
 *
 * @param html 取得済みの HTML 文字列。
 * @param baseUrl 抽出元 URL。og:url 欠損時や例外時の fallback として使う。
 * @returns 抽出結果の `RawOgp`。例外時は `{ url: baseUrl }` の最小形。
 */
export async function extractOgp(
  html: string,
  baseUrl: string,
): Promise<RawOgp> {
  try {
    const response = await ogs({
      html,
      // ogs は html / url 両方指定時に throw する。本実装は Layer 2 で既に
      // 取得済みなので html のみ渡す。
      onlyGetOpenGraphInfo: false,
    })
    if (response.error === true) {
      return { url: baseUrl }
    }
    // 型定義では result は OgObject のため optional プロパティをそのまま参照。
    const result = response.result
    const title = isNonEmptyString(result.ogTitle)
      ? result.ogTitle
      : isNonEmptyString(result.twitterTitle)
        ? result.twitterTitle
        : ''
    const description = isNonEmptyString(result.ogDescription)
      ? result.ogDescription
      : isNonEmptyString(result.twitterDescription)
        ? result.twitterDescription
        : ''
    const url = isNonEmptyString(result.ogUrl) ? result.ogUrl : baseUrl
    const imageUrl =
      firstImageUrl(result.ogImage) ?? firstImageUrl(result.twitterImage)
    const siteName = isNonEmptyString(result.ogSiteName)
      ? result.ogSiteName
      : undefined
    return {
      title,
      description,
      url,
      imageUrl,
      siteName,
    }
  }
  catch {
    // ogs は独自の ErrorResult を throw する。ここでは細分化せず空 RawOgp
    // にフォールバックする (呼出元が url 空で failure 判定できる)。
    return { url: baseUrl }
  }
}
