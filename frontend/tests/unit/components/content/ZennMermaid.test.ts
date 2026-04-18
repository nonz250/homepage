/**
 * `ZennMermaid.vue` のユニットテスト。
 *
 * 検証項目:
 *   - `<ClientOnly>` の `#fallback` として `<pre><code>` に code が出る
 *     (`@vue/test-utils` の mount は SSR fallback のみを描画するため、
 *     クライアント描画結果を直接テストする経路は別途モックを使う)
 *   - props.code が空でも crash しない
 *   - mermaid.render が throw した場合は fallback で `<pre><code>` に落ちる
 *
 * 設計メモ:
 *   - `<ClientOnly>` は Nuxt のグローバルコンポーネント。`@vue/test-utils` 側で
 *     既知でないため、global.stubs で slot 内容を直接描画させるスタブを注入
 *     する。これにより mount 時にデフォルト slot (`ref=container` の div) と
 *     `#fallback` の `<pre><code>` の両方が DOM に並ぶことになるが、本テスト
 *     では「fallback に必ず code が出る」「エラー時に fallback へ切り替わる」
 *     の契約検証に十分
 *   - mermaid ライブラリは `vi.mock` で差し替え、initialize / render の呼び
 *     出しを制御する。動的 import (`await import('mermaid')`) 経路にも
 *     vi.mock が効く (vitest のデフォルト hoist 挙動)。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ZennMermaid from '../../../../components/content/ZennMermaid.vue'

/**
 * `<ClientOnly>` のスタブ。default slot と `#fallback` slot の両方を描画し、
 * 動的 import & onMounted パスが動くようにする。fallback slot 未定義時も
 * エラーにならないよう明示的に optional として扱う。
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
 * mermaid モジュールのモック。describe ごとに mock 実装を差し替えたいので、
 * vi.hoisted で render / initialize 用の spy を切り出す。
 */
const mermaidMocks = vi.hoisted(() => {
  return {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, code: string) => ({
      svg: `<svg data-testid="mermaid-svg" data-code="${code.length}"></svg>`,
    })),
  }
})

vi.mock('mermaid', () => ({
  default: {
    initialize: mermaidMocks.initialize,
    render: mermaidMocks.render,
  },
}))

const BASE_CODE = 'graph TD\nA --> B'

describe('ZennMermaid', () => {
  beforeEach(() => {
    mermaidMocks.initialize.mockClear()
    mermaidMocks.render.mockClear()
    mermaidMocks.render.mockImplementation(async () => ({
      svg: '<svg data-testid="mermaid-svg"></svg>',
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the code inside fallback <pre><code> for SSR / pre-mount state', () => {
    const wrapper = mount(ZennMermaid, {
      props: { code: BASE_CODE },
      global: {
        stubs: { ClientOnly: ClientOnlyStub },
      },
    })
    // fallback slot に code が原文で出ること。
    expect(wrapper.find('pre.mermaid-fallback').exists()).toBe(true)
    expect(wrapper.find('pre.mermaid-fallback code').text()).toContain('graph TD')
    expect(wrapper.find('pre.mermaid-fallback code').text()).toContain('A --> B')
  })

  it('does not crash when code prop is empty', () => {
    const wrapper = mount(ZennMermaid, {
      props: { code: '' },
      global: {
        stubs: { ClientOnly: ClientOnlyStub },
      },
    })
    expect(wrapper.find('pre.mermaid-fallback').exists()).toBe(true)
    // 空文字でも fallback <code> が描画される (中身は空)。
    expect(wrapper.find('pre.mermaid-fallback code').text()).toBe('')
  })

  it('escapes HTML in code via text interpolation (no v-html injection)', () => {
    const malicious = '<script>alert(1)</script>'
    const wrapper = mount(ZennMermaid, {
      props: { code: malicious },
      global: {
        stubs: { ClientOnly: ClientOnlyStub },
      },
    })
    // mustache 補間なので script タグは文字列としてエスケープされる。
    expect(wrapper.html()).not.toContain('<script>alert(1)</script>')
    expect(wrapper.find('pre.mermaid-fallback code').text()).toContain(
      '<script>alert(1)</script>',
    )
  })

  it('calls mermaid.initialize with securityLevel: strict on mount', async () => {
    mount(ZennMermaid, {
      props: { code: BASE_CODE },
      global: {
        stubs: { ClientOnly: ClientOnlyStub },
      },
      attachTo: document.body,
    })
    // onMounted は microtask 完了後に走る。import + render も await するので
    // flushPromises で複数 tick 待つ。
    await flushPromises()
    await flushPromises()
    expect(mermaidMocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
      }),
    )
  })

  it('calls mermaid.render with the provided code and a unique id prefix', async () => {
    mount(ZennMermaid, {
      props: { code: BASE_CODE },
      global: {
        stubs: { ClientOnly: ClientOnlyStub },
      },
      attachTo: document.body,
    })
    await flushPromises()
    await flushPromises()
    expect(mermaidMocks.render).toHaveBeenCalledTimes(1)
    const [id, code] = mermaidMocks.render.mock.calls[0]
    expect(id).toMatch(/^zenn-mermaid-/)
    expect(code).toBe(BASE_CODE)
  })

  it('falls back to <pre><code> when mermaid.render throws', async () => {
    mermaidMocks.render.mockImplementationOnce(async () => {
      throw new Error('invalid DSL')
    })
    const wrapper = mount(ZennMermaid, {
      props: { code: 'invalid mermaid !!!' },
      global: {
        stubs: { ClientOnly: ClientOnlyStub },
      },
      attachTo: document.body,
    })
    await flushPromises()
    await flushPromises()
    // hasError=true により v-if 側の rendered div は消え、fallback のみ残る。
    expect(wrapper.find('.mermaid-rendered').exists()).toBe(false)
    expect(wrapper.find('pre.mermaid-fallback').exists()).toBe(true)
  })

  it('does not call mermaid.render when code is empty (avoids noisy errors)', async () => {
    mount(ZennMermaid, {
      props: { code: '' },
      global: {
        stubs: { ClientOnly: ClientOnlyStub },
      },
      attachTo: document.body,
    })
    await flushPromises()
    await flushPromises()
    expect(mermaidMocks.render).not.toHaveBeenCalled()
  })
})
