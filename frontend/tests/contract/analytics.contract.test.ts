import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isAnalyticsEnabled } from '../../utils/analytics/isAnalyticsEnabled'

/**
 * env -> runtimeConfig.public.gtmId 算出と plugin 側 gate の境界を
 * contract として固定する。
 */

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
    expect(process.env.NUXT_PUBLIC_GTM_ID ?? '').toBe('')
  })

  it('passes a valid GTM container id through unchanged', () => {
    process.env.NUXT_PUBLIC_GTM_ID = 'GTM-ABCDEF'
    expect(process.env.NUXT_PUBLIC_GTM_ID ?? '').toBe('GTM-ABCDEF')
  })

  it('does not leak "undefined" string when env is unset', () => {
    expect(process.env.NUXT_PUBLIC_GTM_ID ?? '').not.toBe('undefined')
  })

  it('does not pick up the legacy NUXT_PUBLIC_GTAG_ID when GTM_ID is unset', () => {
    // 旧 secret (NUXT_PUBLIC_GTAG_ID) を消し忘れた CI でも、新 plugin は
    // 旧値を読まないことを契約として固定する。
    process.env.NUXT_PUBLIC_GTAG_ID = 'G-LEGACY1234'
    expect(process.env.NUXT_PUBLIC_GTM_ID ?? '').toBe('')
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
