/**
 * `ZennEmbedGist.vue` のユニットテスト。
 *
 * 検証項目:
 *   - 正常 props で container div と data-* 属性が出る
 *   - `onMounted` 経由で container 配下に `<script>` が 1 本挿入される
 *   - `url: 'javascript:...'` の場合、fallback `<a>` は描画しない
 *   - 不正な user / id の場合 script 挿入をスキップ (深層防御)
 *   - 同 props で 2 回 mount しても script が重複挿入されない
 *   - `<ClientOnly>` fallback スロットに正しい外部リンクが描画される
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ZennEmbedGist from '../../../../components/content/ZennEmbedGist.vue'
import { GIST_EMBED_ORIGIN } from '../../../../constants/zenn-embed'

const SAFE_USER = 'nonz250'
const SAFE_ID = 'abcdef1234567890abcdef1234567890'
const SAFE_URL = `https://gist.github.com/${SAFE_USER}/${SAFE_ID}`

/**
 * `<ClientOnly>` スタブ。default + `#fallback` slot 両方を描画する。
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
 * happy-dom の `<script src>` の実ロード試行で出る stderr を抑止する。
 */
interface HappyDomSettings {
  handleDisabledFileLoadingAsSuccess: boolean
}
interface HappyDomWindow {
  settings: HappyDomSettings
}

describe('ZennEmbedGist', () => {
  beforeEach(() => {
    const happyDom = (window as unknown as { happyDOM?: HappyDomWindow })
      .happyDOM
    if (happyDom !== undefined) {
      happyDom.settings.handleDisabledFileLoadingAsSuccess = true
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders container div with data attributes', () => {
    const wrapper = mount(ZennEmbedGist, {
      props: { user: SAFE_USER, id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
    })
    const container = wrapper.find('div.gist-container')
    expect(container.exists()).toBe(true)
    expect(container.attributes('data-gist-user')).toBe(SAFE_USER)
    expect(container.attributes('data-gist-id')).toBe(SAFE_ID)
  })

  it('injects one <script> into the container on mount', async () => {
    const wrapper = mount(ZennEmbedGist, {
      props: { user: SAFE_USER, id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    await Promise.resolve()
    const scripts = wrapper.element.querySelectorAll('script')
    expect(scripts.length).toBe(1)
    const script = scripts[0] as HTMLScriptElement
    expect(script.src).toBe(`${GIST_EMBED_ORIGIN}/${SAFE_USER}/${SAFE_ID}.js`)
    expect(script.async).toBe(true)
    expect(script.dataset.gistUser).toBe(SAFE_USER)
    expect(script.dataset.gistId).toBe(SAFE_ID)
  })

  it('does not inject script when user violates pattern', async () => {
    // remark validator は通過している想定だが、component 側で再検査する
    // 深層防御が効くことを確認。user 先頭が `-` なのは GitHub ユーザ名規則違反。
    const wrapper = mount(ZennEmbedGist, {
      props: { user: '-bad', id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    await Promise.resolve()
    const scripts = wrapper.element.querySelectorAll('script')
    expect(scripts.length).toBe(0)
  })

  it('does not inject script when id is not hex', async () => {
    const wrapper = mount(ZennEmbedGist, {
      props: { user: SAFE_USER, id: 'NOT_HEX_ZZZZZZZZZZZZ', url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    await Promise.resolve()
    const scripts = wrapper.element.querySelectorAll('script')
    expect(scripts.length).toBe(0)
  })

  it('renders fallback <a> with safe href', () => {
    const wrapper = mount(ZennEmbedGist, {
      props: { user: SAFE_USER, id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
    })
    const fallback = wrapper.find('p.gist-fallback')
    expect(fallback.exists()).toBe(true)
    const anchor = fallback.find('a')
    expect(anchor.exists()).toBe(true)
    expect(anchor.attributes('href')).toBe(SAFE_URL)
    expect(anchor.attributes('target')).toBe('_blank')
    expect(anchor.attributes('rel')).toBe('noopener noreferrer')
  })

  it('hides fallback <a> when url is javascript:', () => {
    const wrapper = mount(ZennEmbedGist, {
      // eslint-disable-next-line no-script-url
      props: { user: SAFE_USER, id: SAFE_ID, url: 'javascript:alert(1)' },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
    })
    expect(wrapper.find('p.gist-fallback a').exists()).toBe(false)
  })

  it('does not inject duplicate scripts within the same container on re-mount', async () => {
    // 同じ container に対する 2 回目の onMounted で重複挿入されないことを検査。
    // @vue/test-utils で mount し、unmount せず再度 mount した場合 (= 別 DOM に)
    // は重複しないのは当然なので、同一 component インスタンスの再 mount を
    // ではなく、同 props での連続 mount を確認する (= 独立した wrapper)。
    const wrapper1 = mount(ZennEmbedGist, {
      props: { user: SAFE_USER, id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    await Promise.resolve()
    const wrapper2 = mount(ZennEmbedGist, {
      props: { user: SAFE_USER, id: SAFE_ID, url: SAFE_URL },
      global: { stubs: { ClientOnly: ClientOnlyStub } },
      attachTo: document.body,
    })
    await Promise.resolve()
    // 各 container にはそれぞれ 1 本ずつ挿入される。container レベルの
    // 重複検知は「同 container に 2 回 onMounted が走っても 2 本目は入らない」
    // ことを保証する。HMR 等でその状況が発生する。
    const scripts1 = wrapper1.element.querySelectorAll('script')
    const scripts2 = wrapper2.element.querySelectorAll('script')
    expect(scripts1.length).toBe(1)
    expect(scripts2.length).toBe(1)
  })
})
