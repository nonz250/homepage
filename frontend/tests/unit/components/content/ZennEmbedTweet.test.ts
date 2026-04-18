/**
 * `ZennEmbedTweet.vue` のユニットテスト。
 *
 * 検証項目:
 *   - 正常 props で `<blockquote class="twitter-tweet">` と `<a href>` が出る
 *   - `url: 'javascript:...'` で `<a>` が描画されない (深層防御)
 *   - `<ClientOnly>` の `#fallback` スロットにも同じリンクが描画される
 *   - `onMounted` 起動後、`<head>` に widgets.js script が 1 本挿入される
 *   - 2 回目以降の mount では script を重複挿入せず `twttr.widgets.load()` を
 *     呼ぶ
 *
 * 設計メモ:
 *   - `<ClientOnly>` は Nuxt のグローバルコンポーネント。test-utils 側で
 *     既知でないため、global.stubs で default slot と fallback slot の両方を
 *     描画するスタブを注入する
 *   - `document.head` への script 挿入は JSDOM の DOM で実際に行われる。
 *     テスト前後で `<head>` を手動でクリアする
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ZennEmbedTweet from '../../../../components/content/ZennEmbedTweet.vue'
import { TWEET_WIDGETS_SCRIPT_URL } from '../../../../constants/zenn-embed'

const SAFE_URL = 'https://twitter.com/user/status/1234567890123456789'
const SAFE_ID = '1234567890123456789'

/**
 * `<ClientOnly>` のスタブ。default slot + `#fallback` slot の両方を描画する。
 */
const ClientOnlyStub = defineComponent({
  name: 'ClientOnly',
  setup(_, { slots }) {
    return () =>
      h('div', { class: 'client-only-stub' }, [
        slots.default ? slots.default() : null,
        slots.fallback ? slots.fallback() : null,
      ])
  },
})

/**
 * テストの前後で `<head>` 内の tweet widgets.js script を除去する。
 * JSDOM では jsdom テスト間で document が使い回されるため、明示的に掃除する。
 */
function clearWidgetsScript(): void {
  const existing = document.querySelectorAll(
    `script[src="${TWEET_WIDGETS_SCRIPT_URL}"]`,
  )
  existing.forEach((el) => el.remove())
  // window.twttr のグローバル汚染もクリア。
  const global = window as unknown as { twttr?: unknown }
  if (global.twttr !== undefined) {
    delete global.twttr
  }
}

/**
 * happy-dom は `<script src=...>` の実ロードを試みて
 * `Failed to load script ... JavaScript file loading is disabled.` の
 * NotSupportedError を内部 console.error に投げる。本コンポーネントの契約は
 * 「DOM に script タグを 1 本だけ追加する」ことなので、実ロードはそもそも
 * 期待しない。happy-dom の browser setting `handleDisabledFileLoadingAsSuccess`
 * を true にして stderr を抑止する。
 */
interface HappyDomSettings {
  handleDisabledFileLoadingAsSuccess: boolean
}
interface HappyDomWindow {
  settings: HappyDomSettings
}

describe('ZennEmbedTweet', () => {
  beforeEach(() => {
    clearWidgetsScript()
    const happyDom = (window as unknown as { happyDOM?: HappyDomWindow })
      .happyDOM
    if (happyDom !== undefined) {
      happyDom.settings.handleDisabledFileLoadingAsSuccess = true
    }
  })

  afterEach(() => {
    clearWidgetsScript()
    vi.restoreAllMocks()
  })

  it('renders blockquote with data-tweet-id and anchor when url is safe', () => {
    const wrapper = mount(ZennEmbedTweet, {
      props: { id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
    })
    const blockquote = wrapper.find('blockquote.twitter-tweet')
    expect(blockquote.exists()).toBe(true)
    expect(blockquote.attributes('data-tweet-id')).toBe(SAFE_ID)
    const anchor = blockquote.find('a')
    expect(anchor.exists()).toBe(true)
    expect(anchor.attributes('href')).toBe(SAFE_URL)
    expect(anchor.attributes('target')).toBe('_blank')
    expect(anchor.attributes('rel')).toBe('noopener noreferrer')
  })

  it('does not render <a> when url uses javascript: scheme', () => {
    const wrapper = mount(ZennEmbedTweet, {
      // eslint-disable-next-line no-script-url
      props: { id: SAFE_ID, url: 'javascript:alert(1)' },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
    })
    // blockquote 自体は残る (id data 属性のみ) が、`<a>` は出さない。
    expect(wrapper.find('blockquote.twitter-tweet').exists()).toBe(true)
    expect(wrapper.find('blockquote.twitter-tweet a').exists()).toBe(false)
  })

  it('does not render <a> when url is relative', () => {
    const wrapper = mount(ZennEmbedTweet, {
      props: { id: SAFE_ID, url: '/relative/path' },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
    })
    expect(wrapper.find('blockquote.twitter-tweet a').exists()).toBe(false)
  })

  it('renders a fallback blockquote inside the ClientOnly fallback slot', () => {
    const wrapper = mount(ZennEmbedTweet, {
      props: { id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
    })
    // ClientOnlyStub は fallback slot も一緒に描画するので、両方の blockquote が出る。
    const fallback = wrapper.find('blockquote.twitter-tweet-fallback')
    expect(fallback.exists()).toBe(true)
    expect(fallback.find('a').attributes('href')).toBe(SAFE_URL)
  })

  it('injects widgets.js into <head> on mount', async () => {
    mount(ZennEmbedTweet, {
      props: { id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    // onMounted はマイクロタスク経由で走るため、1 tick 待機。
    await Promise.resolve()
    const scripts = document.querySelectorAll(
      `script[src="${TWEET_WIDGETS_SCRIPT_URL}"]`,
    )
    expect(scripts.length).toBe(1)
    const script = scripts[0] as HTMLScriptElement
    expect(script.async).toBe(true)
  })

  it('does not inject a second script when mounted twice', async () => {
    mount(ZennEmbedTweet, {
      props: { id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    await Promise.resolve()
    // 1 本目を注入したタイミングで `window.twttr` を模擬する
    // (実環境では widgets.js が自身を evaluate してセットする)。
    const loadSpy = vi.fn()
    ;(window as unknown as { twttr?: unknown }).twttr = {
      widgets: { load: loadSpy },
    }
    mount(ZennEmbedTweet, {
      props: { id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    await Promise.resolve()
    const scripts = document.querySelectorAll(
      `script[src="${TWEET_WIDGETS_SCRIPT_URL}"]`,
    )
    expect(scripts.length).toBe(1)
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })
})
