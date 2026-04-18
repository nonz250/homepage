import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZennDetails from '../../../../components/content/ZennDetails.vue'

/**
 * ZennDetails は `:::details タイトル` 記法の MDC 出力先となる
 * presentational コンポーネント。
 *
 * 折りたたみ状態はブラウザ側の `<details>` が握るため、Vue 側では
 * 以下の描画契約のみを検証する:
 *   - `<details>` / `<summary>` が出力される
 *   - `title` prop が `<summary>` に入る
 *   - default slot が `<details>` 直下に入る
 *   - `title` が空文字でも crash しない
 */
describe('ZennDetails', () => {
  it('renders details and summary elements', () => {
    const wrapper = mount(ZennDetails, {
      props: { title: '詳細' },
      slots: { default: '本文' },
    })
    expect(wrapper.find('details').exists()).toBe(true)
    expect(wrapper.find('summary').exists()).toBe(true)
  })

  it('places the title inside the summary element', () => {
    const wrapper = mount(ZennDetails, {
      props: { title: '詳細' },
      slots: { default: '本文' },
    })
    expect(wrapper.find('summary').text()).toBe('詳細')
  })

  it('renders the default slot as part of details body', () => {
    const wrapper = mount(ZennDetails, {
      props: { title: '詳細' },
      slots: { default: '本文' },
    })
    const bodyText = wrapper.find('.body').text()
    expect(bodyText).toContain('本文')
  })

  it('renders both summary title and body content', () => {
    const wrapper = mount(ZennDetails, {
      props: { title: '詳細' },
      slots: { default: '本文' },
    })
    const text = wrapper.text()
    expect(text).toContain('詳細')
    expect(text).toContain('本文')
  })

  it('does not crash with empty title', () => {
    const wrapper = mount(ZennDetails, {
      props: { title: '' },
      slots: { default: '本文' },
    })
    expect(wrapper.find('summary').exists()).toBe(true)
    expect(wrapper.find('summary').text()).toBe('')
    expect(wrapper.find('.body').text()).toContain('本文')
  })

  it('renders HTML structure with details wrapping summary and body', () => {
    const wrapper = mount(ZennDetails, {
      props: { title: '詳細' },
      slots: { default: '本文' },
    })
    // summary は details 直下の子要素として配置される。
    const details = wrapper.find('details').element
    expect(details.firstElementChild?.tagName.toLowerCase()).toBe('summary')
  })
})
