/**
 * `published_at` 文字列を Unix epoch ミリ秒に変換する純関数。
 *
 * frontmatter の `published_at` は schema (`scripts/lib/schema/publishedAt.ts`)
 * 上 3 形式を受理する:
 *
 *   1. `YYYY-MM-DD HH:mm`               — Zenn Connect 現行フォーマット (TZ なし)
 *   2. `YYYY-MM-DDTHH:mm:ss±HH:mm`      — ISO 8601 with numeric offset
 *   3. `YYYY-MM-DDTHH:mm:ssZ`           — ISO 8601 UTC
 *
 * 1. の Zenn Legacy フォーマットには TZ 情報が含まれない。`Date.parse` の
 * 挙動はホスト OS のタイムゾーンに依存し、CI (GitHub Actions ubuntu-latest =
 * UTC) では「21:00 UTC」として解釈されるため、ビルド時刻と比較した予約投稿
 * 判定 (`buildPrerenderRoutes` / `buildTagsIndex`) で記事が誤って除外され、
 * `/articles/<slug>/` が 404 になる事故を起こした。
 *
 * Zenn Connect 自体が日本のサービスでありデフォルトを JST として運用して
 * いるため、本ヘルパーも TZ なし入力は **JST (UTC+9) として解釈** する。
 * ISO 8601 with offset / `Z` 付きは表記通りの絶対時刻として扱う。
 *
 * 戻り値:
 *   - 解釈に成功: Unix epoch ミリ秒 (number)
 *   - 解釈に失敗: `NaN` (`Date.parse` の挙動を踏襲し、呼び出し側の
 *     `Number.isNaN` 分岐をそのまま再利用できるようにする)
 */

/**
 * Zenn Connect 互換の TZ 無し datetime 形式 (`YYYY-MM-DD HH:mm`)。
 *
 * scripts 側の `PUBLISHED_AT_ZENN_LEGACY_PATTERN` と同等。schema は scripts/
 * 側に集約されているが、frontend からの import は別経路 (vitest 設定 / Nuxt
 * alias の制約) で簡単に共有できないため、ここでも独立に持つ。仕様変更時は
 * 両ファイルを同期する。
 */
export const PUBLISHED_AT_ZENN_LEGACY_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d$/

/** Zenn Legacy 形式に補う JST オフセット表記 */
const JST_OFFSET_SUFFIX = '+09:00'

/**
 * `published_at` 文字列を Unix epoch ミリ秒に変換する。
 *
 * @param value `published_at` の生文字列 (schema 受理済み想定)
 * @returns 解釈成功時は ms、失敗時は `NaN`
 */
export function parsePublishedAtMs(value: string): number {
  if (PUBLISHED_AT_ZENN_LEGACY_PATTERN.test(value)) {
    return Date.parse(`${value.replace(' ', 'T')}:00${JST_OFFSET_SUFFIX}`)
  }
  return Date.parse(value)
}
