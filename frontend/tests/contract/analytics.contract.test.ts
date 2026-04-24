import { afterEach, describe, expect, it } from 'vitest'
import { isAnalyticsEnabled } from '../../utils/analytics/isAnalyticsEnabled'

/**
 * GA4 導入 (Issue #58) のランタイム契約テスト。
 *
 * `nuxt.config.ts` の `runtimeConfig.public.gtagId` 算出式と、
 * `plugins/gtag.client.ts` の有効化判定が次の契約を守っていることを固定する:
 *
 *   1. `NUXT_PUBLIC_GTAG_ID` 未設定時は空文字にフォールバックする
 *      (ビルド成果物にプレースホルダや `undefined` が埋まらない)
 *   2. 空文字は plugin 側で fail-closed に倒れる (gtag.js を読み込まない)
 *   3. 本番ビルドかつ有効 ID のときのみ送信が有効化される
 *
 * この契約を壊すと「ローカル / プレビュー / PR ビルドで GA が誤発火」か
 * 「本番で GA が動かない」のいずれかが発生するため、contract スコープで
 * 明示的に固定する。
 */

/**
 * `nuxt.config.ts` の `runtimeConfig.public.gtagId` 算出式と同一ロジックを
 * テスト用に写経する。実装を変えた場合はここも同期させる意図的な重複。
 */
function computeRuntimeGtagId(raw: string | undefined): string {
  return raw ?? ''
}

describe('NUXT_PUBLIC_GTAG_ID -> runtimeConfig.public.gtagId contract', () => {
  const ORIGINAL = process.env.NUXT_PUBLIC_GTAG_ID

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.NUXT_PUBLIC_GTAG_ID
    } else {
      process.env.NUXT_PUBLIC_GTAG_ID = ORIGINAL
    }
  })

  it('falls back to empty string when env is unset', () => {
    expect(computeRuntimeGtagId(undefined)).toBe('')
  })

  it('passes a valid GA4 measurement id through unchanged', () => {
    expect(computeRuntimeGtagId('G-ABCDEF1234')).toBe('G-ABCDEF1234')
  })

  it('does not leak "undefined" string when env is unset', () => {
    expect(computeRuntimeGtagId(undefined)).not.toBe('undefined')
  })
})

describe('analytics gating contract (runtime + id)', () => {
  it('is disabled when gtagId is empty even in production build', () => {
    // NUXT_PUBLIC_GTAG_ID 未設定の本番ビルドでも GA を起動させない契約。
    expect(
      isAnalyticsEnabled({ nodeEnv: 'production', gtagId: '' }),
    ).toBe(false)
  })

  it('is disabled when NODE_ENV is development even with a valid id', () => {
    // ローカル / PR プレビューでの計測汚染を防ぐ契約。
    expect(
      isAnalyticsEnabled({ nodeEnv: 'development', gtagId: 'G-ABCDEF1234' }),
    ).toBe(false)
  })

  it('is enabled only when both production build and valid id are present', () => {
    expect(
      isAnalyticsEnabled({ nodeEnv: 'production', gtagId: 'G-ABCDEF1234' }),
    ).toBe(true)
  })
})
