import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZennMessage from '../../../../components/content/ZennMessage.vue'

/**
 * ZennMessage コンポーネントの描画契約を検証する。
 *
 * 本コンポーネントは rehype パイプラインから MDC 経由でレンダリングされる
 * presentational コンポーネントで、以下の振る舞いを保つ必要がある:
 *   - default type (`info`) で info クラスが付く
 *   - `alert` type で alert クラスが付く
 *   - 未知の type は info にフォールバックする
 *   - slot なしでも描画が壊れない
 */
describe('ZennMessage', () => {
  it('renders default slot content', () => {
    const wrapper = mount(ZennMessage, {
      props: { type: 'info' },
      slots: { default: 'Hello' },
    })
    expect(wrapper.text()).toContain('Hello')
  })

  it('applies msg--info class for info type', () => {
    const wrapper = mount(ZennMessage, {
      props: { type: 'info' },
      slots: { default: 'body' },
    })
    const root = wrapper.find('.msg')
    expect(root.classes()).toContain('msg--info')
    expect(root.classes()).not.toContain('msg--alert')
  })

  it('applies msg--info class when type is omitted', () => {
    const wrapper = mount(ZennMessage, {
      slots: { default: 'body' },
    })
    const root = wrapper.find('.msg')
    expect(root.classes()).toContain('msg--info')
  })

  it('applies msg--alert class for alert type', () => {
    const wrapper = mount(ZennMessage, {
      props: { type: 'alert' },
      slots: { default: 'warn body' },
    })
    const root = wrapper.find('.msg')
    expect(root.classes()).toContain('msg--alert')
    expect(root.classes()).not.toContain('msg--info')
  })

  it('falls back to info for unknown type', () => {
    const wrapper = mount(ZennMessage, {
      // 未知の type を受け取ったときも描画を壊さないための fallback 挙動を検証。
      props: { type: 'unknown' as unknown as 'info' },
      slots: { default: 'body' },
    })
    const root = wrapper.find('.msg')
    expect(root.classes()).toContain('msg--info')
    expect(root.classes()).not.toContain('msg--alert')
  })

  it('does not crash when no default slot is provided', () => {
    const wrapper = mount(ZennMessage, {
      props: { type: 'info' },
    })
    expect(wrapper.find('.msg').exists()).toBe(true)
    // slot が無くてもアイコンは常にレンダリングされる。
    expect(wrapper.find('.icon').exists()).toBe(true)
  })

  it('emits distinct icon text per type', () => {
    const info = mount(ZennMessage, {
      props: { type: 'info' },
      slots: { default: 'x' },
    })
    const alert = mount(ZennMessage, {
      props: { type: 'alert' },
      slots: { default: 'x' },
    })
    expect(info.find('.icon').text()).not.toBe(alert.find('.icon').text())
  })

  it('sets an aria-label that communicates the message type', () => {
    const info = mount(ZennMessage, {
      props: { type: 'info' },
      slots: { default: 'x' },
    })
    const alert = mount(ZennMessage, {
      props: { type: 'alert' },
      slots: { default: 'x' },
    })
    // aria-label は空でなく、type に応じて異なる文言になることを確認する。
    expect(info.find('.msg').attributes('aria-label')).toBeTruthy()
    expect(info.find('.msg').attributes('aria-label')).not.toEqual(
      alert.find('.msg').attributes('aria-label'),
    )
  })
})
