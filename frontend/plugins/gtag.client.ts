import { isAnalyticsEnabled } from '../utils/analytics/isAnalyticsEnabled'
import { buildGtagScriptSrc } from '../utils/analytics/buildGtagScriptSrc'

/**
 * GA4 (gtag.js) クライアントプラグイン。
 *
 * 挙動:
 *   - `runtimeConfig.public.gtagId` と `NODE_ENV === 'production'` の AND で
 *     有効化される (`isAnalyticsEnabled`)。いずれかを満たさない場合は
 *     何もしない (gtag.js の読み込みも行わず、`window.dataLayer` にも触れない)。
 *   - 有効時は gtag.js を `<head>` に追加し、`config <id>` で初期化する。
 *     `send_page_view: false` を指定し、初回 page_view は本プラグインから
 *     1 回だけ送る。以後は Vue Router の `afterEach` から SPA 遷移ごとに
 *     送信する。`lastSentPath` による dedup で同一パスへの連続送信を防ぐ。
 *   - SSG ビルドでは `.client.ts` 拡張子によりサーバ側では評価されない。
 *
 * SPA ページビュー送信の設計意図:
 *   - `send_page_view: true` (default) にすると gtag が config 呼び出し時
 *     に自動で page_view を送るが、Nuxt の hydration タイミングと config
 *     の評価順序が環境により揺らぐため、手動送信でタイミングを固定する。
 *   - `afterEach` は Vue Router 4 の仕様上、初回 navigation では
 *     発火しないので、初回ページビューを `app:mounted` フックで明示的に
 *     1 回送る。dedup は「直近送信パス」との同一性チェックで行う。
 */

/**
 * gtag 関数の最小型定義。`gtag()` は可変長引数の関数として振る舞うため
 * `unknown[]` で受け取り、`dataLayer` に push する実装と揃える。
 */
type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const gtagId = (config.public.gtagId as string | undefined) ?? ''
  // process.env.NODE_ENV はクライアントバンドルでも webpack/vite により
  // `"production"` 等のリテラルに置換されるため、runtimeConfig 経由で
  // 別途配る必要はない。
  const nodeEnv = process.env.NODE_ENV

  if (!isAnalyticsEnabled({ nodeEnv, gtagId })) {
    return
  }

  // Google 推奨のブートストラップ順序:
  //   1. `window.dataLayer` を配列で確保
  //   2. `gtag` を dataLayer.push に束ねる
  //   3. `gtag('js', new Date())` と `gtag('config', <id>, {...})` を呼ぶ
  //   4. 非同期で gtag.js を読み込む
  window.dataLayer = window.dataLayer ?? []
  const gtag: GtagFn = function (...args) {
    window.dataLayer!.push(args)
  }
  window.gtag = gtag

  gtag('js', new Date())
  gtag('config', gtagId, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = buildGtagScriptSrc(gtagId)
  document.head.appendChild(script)

  let lastSentPath: string | null = null

  const sendPageView = (path: string) => {
    if (path === lastSentPath) {
      return
    }
    lastSentPath = path
    gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.origin + path,
    })
  }

  const router = nuxtApp.$router as
    | {
        afterEach: (cb: (to: { fullPath: string }) => void) => void
        currentRoute: { value: { fullPath: string } }
      }
    | undefined

  nuxtApp.hook('app:mounted', () => {
    const initialPath =
      router?.currentRoute.value.fullPath ??
      window.location.pathname + window.location.search
    sendPageView(initialPath)
  })

  router?.afterEach((to) => {
    sendPageView(to.fullPath)
  })
})
