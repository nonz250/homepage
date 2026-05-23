import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildGtmScriptSrc } from '../../../utils/analytics/buildGtmScriptSrc'

/**
 * `plugins/gtm.client.ts` の副作用テスト。
 *
 * Nuxt の auto-import (`defineNuxtPlugin` / `useRuntimeConfig`) は本番ビルドでは
 * `#imports` 経由で自動付与されるが、vitest 上では auto-import は走らず
 * `vi.mock('#imports', ...)` も plugin 本体に効かない (plugin 側が #imports を
 * 明示 import していないため)。
 *
 * そこで globalThis に直接スタブを刺すことで、plugin 本体を無改変で評価可能に
 * する。`vi.resetModules()` + `await import(...)` で各ケース 1 回ずつ bootstrap
 * を再評価する。
 */

const runtimeConfigStub = { public: { gtmId: '' } as { gtmId: string } }

;(globalThis as Record<string, unknown>).defineNuxtPlugin = (fn: unknown) => fn
;(globalThis as Record<string, unknown>).useRuntimeConfig = () =>
  runtimeConfigStub

async function loadPluginBootstrap(): Promise<() => unknown> {
  vi.resetModules()
  const mod = await import('../../../plugins/gtm.client')
  return mod.default as () => unknown
}

/**
 * `document.head.appendChild` を spy する。
 *
 * happy-dom は <script src> を appendChild するだけで外部 fetch を試み、
 * テスト出力に DOMException が漏れる。appendChild 自体を no-op に差し替え、
 * 「何が append されたか」だけを記録する (plugin 側は戻り値を使わない
 * ので差し替えは安全)。
 */
function spyOnHeadAppend(): { appended: HTMLScriptElement[] } {
  const appended: HTMLScriptElement[] = []
  vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
    if (node instanceof HTMLScriptElement) {
      appended.push(node)
    }
    return node
  })
  return { appended }
}

describe('plugins/gtm.client', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    delete (window as unknown as { dataLayer?: unknown[] }).dataLayer
    runtimeConfigStub.public.gtmId = ''
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('disabled cases (fail-closed)', () => {
    it('does nothing when gtmId is empty even in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      runtimeConfigStub.public.gtmId = ''
      const { appended } = spyOnHeadAppend()

      const bootstrap = await loadPluginBootstrap()
      bootstrap()

      expect(
        (window as unknown as { dataLayer?: unknown[] }).dataLayer,
      ).toBeUndefined()
      expect(appended).toHaveLength(0)
    })

    it('does nothing when gtmId looks like a GA4 measurement id', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      runtimeConfigStub.public.gtmId = 'G-ABCDEF1234'
      const { appended } = spyOnHeadAppend()

      const bootstrap = await loadPluginBootstrap()
      bootstrap()

      expect(
        (window as unknown as { dataLayer?: unknown[] }).dataLayer,
      ).toBeUndefined()
      expect(appended).toHaveLength(0)
    })

    it('does nothing when NODE_ENV is not production', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      runtimeConfigStub.public.gtmId = 'GTM-ABCDEF'
      const { appended } = spyOnHeadAppend()

      const bootstrap = await loadPluginBootstrap()
      bootstrap()

      expect(
        (window as unknown as { dataLayer?: unknown[] }).dataLayer,
      ).toBeUndefined()
      expect(appended).toHaveLength(0)
    })
  })

  describe('enabled (production + valid container id)', () => {
    const VALID_ID = 'GTM-ABCDEF'

    it('seeds window.dataLayer with the gtm.start event', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      runtimeConfigStub.public.gtmId = VALID_ID
      spyOnHeadAppend()

      const bootstrap = await loadPluginBootstrap()
      bootstrap()

      const dataLayer = (window as unknown as { dataLayer?: unknown[] })
        .dataLayer
      expect(Array.isArray(dataLayer)).toBe(true)
      expect(dataLayer!.length).toBeGreaterThanOrEqual(1)

      const entry = dataLayer![0] as Record<string, unknown>
      expect(typeof entry['gtm.start']).toBe('number')
      expect(entry.event).toBe('gtm.js')
    })

    it('appends a gtm.js script tag with the canonical src and async flag', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      runtimeConfigStub.public.gtmId = VALID_ID
      const { appended } = spyOnHeadAppend()

      const bootstrap = await loadPluginBootstrap()
      bootstrap()

      expect(appended).toHaveLength(1)
      const script = appended[0]
      expect(script.src).toBe(buildGtmScriptSrc(VALID_ID))
      expect(script.async).toBe(true)
    })
  })
})
