// `.client` サフィックスにより SSR 評価対象外。
import { isAnalyticsEnabled } from '../utils/analytics/isAnalyticsEnabled'
import { buildGtmScriptSrc } from '../utils/analytics/buildGtmScriptSrc'

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const gtmId = (config.public.gtmId as string | undefined) ?? ''
  const nodeEnv = process.env.NODE_ENV

  if (!isAnalyticsEnabled({ nodeEnv, gtmId })) {
    return
  }

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = buildGtmScriptSrc(gtmId)
  document.head.appendChild(script)

  // GTM の History Change Trigger と plugin 側 router フックが二重発火するため、
  // plugin では router を見ない。SPA ページビューの dedup と発火はコンテナ側で扱う。
})
