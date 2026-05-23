import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isAnalyticsEnabled } from '../../utils/analytics/isAnalyticsEnabled'

/**
 * GTM 導入 (Issue #58) のランタイム契約テスト。
 *
 * `nuxt.config.ts` の `runtimeConfig.public.gtmId` 算出式と、
 * `plugins/gtm.client.ts` の有効化判定が次の契約を守っていることを固定する:
 *
 *   1. `NUXT_PUBLIC_GTM_ID` 未設定時は空文字にフォールバックする
 *      (ビルド成果物にプレースホルダや `undefined` が埋まらない)
 *   2. 空文字は plugin 側で fail-closed に倒れる (gtm.js を読み込まない)
 *   3. 本番ビルドかつ有効 ID のときのみ送信が有効化される
 *   4. 旧 NUXT_PUBLIC_GTAG_ID が誤って残っていても新 plugin は反応しない
 *      (CI secret 切替時に旧値が読まれて GA を誤発火させない)
 *
 * この契約を壊すと「ローカル / プレビュー / PR ビルドで GA が誤発火」か
 * 「本番で GA が動かない」のいずれかが発生するため、contract スコープで
 * 明示的に固定する。
 */

/**
 * `nuxt.config.ts` の `runtimeConfig.public.gtmId` 算出式と同一ロジックを
 * テスト用に写経する。実装を変えた場合はここも同期させる意図的な重複。
 */
function computeRuntimeGtmId(raw: string | undefined): string {
  return raw ?? ''
}

describe('NUXT_PUBLIC_GTM_ID -> runtimeConfig.public.gtmId contract', () => {
  beforeEach(() => {
    delete process.env.NUXT_PUBLIC_GTAG_ID
    delete process.env.NUXT_PUBLIC_GTM_ID
  })

  afterEach(() => {
    delete process.env.NUXT_PUBLIC_GTAG_ID
    delete process.env.NUXT_PUBLIC_GTM_ID
  })

  it('falls back to empty string when env is unset', () => {
    expect(computeRuntimeGtmId(process.env.NUXT_PUBLIC_GTM_ID)).toBe('')
  })

  it('passes a valid GTM container id through unchanged', () => {
    process.env.NUXT_PUBLIC_GTM_ID = 'GTM-ABCDEF'
    expect(computeRuntimeGtmId(process.env.NUXT_PUBLIC_GTM_ID)).toBe(
      'GTM-ABCDEF',
    )
  })

  it('does not leak "undefined" string when env is unset', () => {
    expect(computeRuntimeGtmId(process.env.NUXT_PUBLIC_GTM_ID)).not.toBe(
      'undefined',
    )
  })

  it('does not pick up the legacy NUXT_PUBLIC_GTAG_ID when GTM_ID is unset', () => {
    // 旧 secret (NUXT_PUBLIC_GTAG_ID) を消し忘れた CI でも、新 plugin は
    // 旧値を読まないことを契約として固定する。
    process.env.NUXT_PUBLIC_GTAG_ID = 'G-LEGACY1234'
    expect(computeRuntimeGtmId(process.env.NUXT_PUBLIC_GTM_ID)).toBe('')
  })
})

describe('analytics gating contract (runtime + id)', () => {
  it('is disabled when gtmId is empty even in production build', () => {
    // NUXT_PUBLIC_GTM_ID 未設定の本番ビルドでも GA を起動させない契約。
    expect(isAnalyticsEnabled({ nodeEnv: 'production', gtmId: '' })).toBe(false)
  })

  it('is disabled when NODE_ENV is development even with a valid id', () => {
    // ローカル / PR プレビューでの計測汚染を防ぐ契約。
    expect(
      isAnalyticsEnabled({ nodeEnv: 'development', gtmId: 'GTM-ABCDEF' }),
    ).toBe(false)
  })

  it('is enabled only when both production build and valid id are present', () => {
    expect(
      isAnalyticsEnabled({ nodeEnv: 'production', gtmId: 'GTM-ABCDEF' }),
    ).toBe(true)
  })

  it('is disabled when a GA4 measurement id is supplied to the GTM gate', () => {
    // 旧 secret 値 (GA4 measurement id) がそのまま gtmId に流れ込んでも、
    // 形式不一致で fail-closed に倒れることを固定する。
    expect(
      isAnalyticsEnabled({ nodeEnv: 'production', gtmId: 'G-ABCDEF1234' }),
    ).toBe(false)
  })
})
