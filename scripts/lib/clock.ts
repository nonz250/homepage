import {
  PUBLISHED_AT_ISO_OFFSET_PATTERN,
  PUBLISHED_AT_ISO_UTC_PATTERN,
  PUBLISHED_AT_ZENN_LEGACY_PATTERN,
} from './constants'

/**
 * 時刻取得の抽象。
 *
 * generator 側で「現在時刻と `published_at` を比較して未来日を除外する」処理を
 * 書く際、本番では `systemClock` を使い、テストでは `fixedClock` を注入する。
 * 副作用 (Date.now 呼び出し) を 1 箇所に閉じることで、ロジックを純関数として
 * 扱えるようにする。
 */
export interface Clock {
  readonly now: () => Date
}

/**
 * 本番経路で使用する、システム時計由来の Clock。
 *
 * 呼び出しごとに新しい Date を返すため、キャッシュはされない。
 */
export const systemClock: Clock = {
  now: () => new Date(),
}

/**
 * テスト向け: 固定時刻を返す Clock を生成する。
 *
 * 受け取る ISO 文字列は `new Date()` に解釈可能な形式 (例: 2026-04-19T12:00:00Z)。
 * 呼び出しごとに新しい Date インスタンスを返し、呼び出し側が Date を mutate
 * しても内部状態に影響しないようにする。
 *
 * @throws 入力が Date として解釈不能な場合 (NaN)。
 */
export function fixedClock(isoString: string): Clock {
  const baseMillis = Date.parse(isoString)
  if (Number.isNaN(baseMillis)) {
    throw new Error(
      `[fixedClock] invalid ISO string: ${JSON.stringify(isoString)}`,
    )
  }
  return {
    now: () => new Date(baseMillis),
  }
}

/**
 * JST (+09:00) をデフォルトの暗黙タイムゾーンとして扱うためのオフセット。
 *
 * `YYYY-MM-DD HH:mm` 形式 (Zenn Connect legacy) はタイムゾーン情報を持たない
 * ため、原典の運用方針に従い JST として解釈する。ISO 8601 (offset / UTC) 形式
 * の入力はそちらのオフセットを優先する。
 */
const JST_OFFSET_SUFFIX = '+09:00'

/**
 * published_at 文字列を Date に変換する純関数。
 *
 * 受理形式:
 *   - `YYYY-MM-DD HH:mm`             → JST (+09:00) として扱う
 *   - `YYYY-MM-DDTHH:mm:ss±HH:mm`    → そのまま Date.parse に委譲
 *   - `YYYY-MM-DDTHH:mm:ssZ`         → そのまま Date.parse に委譲
 *
 * いずれの形式にもマッチしない場合は throw。
 */
function parsePublishedAt(publishedAt: string): Date {
  if (PUBLISHED_AT_ZENN_LEGACY_PATTERN.test(publishedAt)) {
    // "YYYY-MM-DD HH:mm" → "YYYY-MM-DDTHH:mm:00+09:00"
    const [datePart, timePart] = publishedAt.split(' ')
    const iso = `${datePart}T${timePart}:00${JST_OFFSET_SUFFIX}`
    const millis = Date.parse(iso)
    if (Number.isNaN(millis)) {
      throw new Error(
        `[parsePublishedAt] cannot interpret Zenn legacy format: ${JSON.stringify(publishedAt)}`,
      )
    }
    return new Date(millis)
  }
  if (
    PUBLISHED_AT_ISO_OFFSET_PATTERN.test(publishedAt) ||
    PUBLISHED_AT_ISO_UTC_PATTERN.test(publishedAt)
  ) {
    const millis = Date.parse(publishedAt)
    if (Number.isNaN(millis)) {
      throw new Error(
        `[parsePublishedAt] cannot parse ISO published_at: ${JSON.stringify(publishedAt)}`,
      )
    }
    return new Date(millis)
  }
  throw new Error(
    `[parsePublishedAt] unrecognized published_at format: ${JSON.stringify(publishedAt)}`,
  )
}

/**
 * `published_at` が Clock.now() よりも **厳密に未来** であるかを判定する純関数。
 *
 * fail-closed 方針として、同時刻は「未来ではない (= 公開対象)」と扱う。
 * published_at 文字列の形式が受理外の場合は throw する (上位でキャッチ不能な
 * 運用事故を早期検出する狙い)。
 */
export function isFuturePublish(publishedAt: string, clock: Clock): boolean {
  const published = parsePublishedAt(publishedAt)
  const now = clock.now()
  return published.getTime() > now.getTime()
}
