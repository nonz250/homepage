/**
 * `ZennEmbedCard.vue` のユニットテスト。
 *
 * 検証項目:
 *   - 正常 props で card が描画され、title / description / host / siteName が
 *     mustache 補間で出力される
 *   - `javascript:` URL は `<a>` でなく `<span>` に退避される (深層防御)
 *   - `imagePath` が null / 空文字で `<img>` が描画されない
 *   - `target="_blank"` + `rel="noopener noreferrer"` が付く
 *   - `description` が空文字で description ブロックが描画されない
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZennEmbedCard from '../../../../components/content/ZennEmbedCard.vue'

const SAFE_URL = 'https://example.com/article'
const BASE_PROPS = {
  title: 'Example title',
  description: 'A short description.',
  url: SAFE_URL,
  imagePath: '/ogp-images/abc.png',
  siteName: 'Example',
}

describe('ZennEmbedCard', () => {
  it('renders an anchor when url is http(s)', () => {
    const wrapper = mount(ZennEmbedCard, { props: BASE_PROPS })
    expect(wrapper.find('a').exists()).toBe(true)
    expect(wrapper.find('a').attributes('href')).toBe(SAFE_URL)
  })

  it('sets target=_blank and rel=noopener noreferrer', () => {
    const wrapper = mount(ZennEmbedCard, { props: BASE_PROPS })
    const anchor = wrapper.find('a')
    expect(anchor.attributes('target')).toBe('_blank')
    expect(anchor.attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders title, description, siteName, and host via text interpolation', () => {
    const wrapper = mount(ZennEmbedCard, { props: BASE_PROPS })
    const text = wrapper.text()
    expect(text).toContain('Example title')
    expect(text).toContain('A short description.')
    expect(text).toContain('Example')
    expect(text).toContain('example.com')
  })

  it('renders the image when imagePath is a non-empty string', () => {
    const wrapper = mount(ZennEmbedCard, { props: BASE_PROPS })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/ogp-images/abc.png')
  })

  it('does not render the image when imagePath is null', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, imagePath: null },
    })
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('does not render the image when imagePath is empty string', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, imagePath: '' },
    })
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('falls back to a span (not anchor) when url uses javascript: scheme', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, url: 'javascript:alert(1)' },
    })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('span.card').exists()).toBe(true)
  })

  it('falls back to a span when url is data:', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, url: 'data:text/html,<h1>x</h1>' },
    })
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('falls back to a span when url is relative', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, url: '/relative/path' },
    })
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('omits description block when description is empty', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, description: '' },
    })
    expect(wrapper.find('.card__description').exists()).toBe(false)
  })

  it('omits site-name when siteName is empty', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, siteName: '' },
    })
    expect(wrapper.find('.card__site-name').exists()).toBe(false)
  })

  it('omits site-name when siteName is null', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, siteName: null },
    })
    expect(wrapper.find('.card__site-name').exists()).toBe(false)
  })

  it('does not inject html from title (textContent only)', () => {
    const wrapper = mount(ZennEmbedCard, {
      props: { ...BASE_PROPS, title: '<script>alert(1)</script>evil' },
    })
    // mustache 補間なので innerHTML にタグが出てこないこと (エンティティ化される)
    expect(wrapper.html()).not.toContain('<script>alert(1)</script>')
    // text としては表示される。
    expect(wrapper.text()).toContain('alert(1)')
  })
})
