import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleTags from '../../../components/parts/ArticleTags.vue'

/**
 * ArticleTags は topics 配列を横並びバッジで表示するだけの
 * presentational コンポーネント。topics 空配列でも crash せず、
 * 通常配列は `<li>` で並ぶことを確認する。
 */
describe('ArticleTags', () => {
  it('renders topics as list items', () => {
    const wrapper = mount(ArticleTags, {
      props: { topics: ['vue', 'nuxt', 'blog'] },
    })
    const items = wrapper.findAll('li')
    expect(items.map((i) => i.text())).toEqual(['vue', 'nuxt', 'blog'])
  })

  it('renders nothing when topics is empty', () => {
    const wrapper = mount(ArticleTags, {
      props: { topics: [] },
    })
    expect(wrapper.find('ul').exists()).toBe(false)
  })

  it('renders nothing when topics prop is omitted', () => {
    const wrapper = mount(ArticleTags)
    expect(wrapper.find('ul').exists()).toBe(false)
  })

  it('does not render clickable links (Phase 1 spec)', () => {
    const wrapper = mount(ArticleTags, {
      props: { topics: ['blog'] },
    })
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
