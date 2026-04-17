/**
 * 記事の公開日付を表示用にフォーマットする純関数。
 *
 * frontmatter の `published_at` は ISO8601 (offset 付き) の文字列。
 * UI 表示では `YYYY-MM-DD` のみ使うため、Date オブジェクトを経由せず
 * 文字列の先頭 10 文字を取得する形で決定的にする。
 * (タイムゾーン変換による表示のブレを避ける目的)
 *
 * Date.parse が不正な文字列は空文字を返して fail-closed 的に扱う。
 */

/** `YYYY-MM-DD` の長さ */
const DATE_ONLY_LENGTH = 10

export function formatPublishedDate(published_at: string | undefined): string {
  if (typeof published_at !== 'string' || published_at === '') {
    return ''
  }
  if (Number.isNaN(Date.parse(published_at))) {
    return ''
  }
  return published_at.slice(0, DATE_ONLY_LENGTH)
}
