import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleToc from '../../../components/parts/ArticleToc.vue'

/**
 * ArticleToc は props で渡された headings を描画するだけの
 * presentational コンポーネント。空配列と通常配列の両ケースで
 * 期待通りの描画 (or 非描画) になることを確認する。
 */
describe('ArticleToc', () => {
  it('renders nothing when headings is empty', () => {
    const wrapper = mount(ArticleToc, {
      props: { headings: [] },
    })
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders nothing when headings prop is omitted', () => {
    const wrapper = mount(ArticleToc)
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders heading links with anchor hrefs', () => {
    const wrapper = mount(ArticleToc, {
      props: {
        headings: [
          { id: 'section-1', text: 'Section 1', depth: 2 },
          { id: 'section-1-1', text: 'Section 1-1', depth: 3 },
        ],
      },
    })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toBe('#section-1')
    expect(links[0].text()).toBe('Section 1')
    expect(links[1].attributes('href')).toBe('#section-1-1')
  })

  it('applies depth-* class based on depth value', () => {
    const wrapper = mount(ArticleToc, {
      props: {
        headings: [
          { id: 'h2', text: 'h2', depth: 2 },
          { id: 'h3', text: 'h3', depth: 3 },
        ],
      },
    })
    const items = wrapper.findAll('.toc-item')
    expect(items[0].classes()).toContain('depth-2')
    expect(items[1].classes()).toContain('depth-3')
  })
})
