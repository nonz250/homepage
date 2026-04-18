import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleCard from '../../../components/parts/ArticleCard.vue'
import type { Article } from '../../../utils/article/articleVisibility'

/**
 * ArticleCard は presentational only。
 *
 * props で受け取った記事メタ (タイトル / topics / 公開日) が DOM に
 * 描画され、かつ Draft バッジの表示制御が `isDraft` prop と一致する
 * ことを検証する。
 */
const baseArticle: Article = {
  slug: 'welcome',
  path: '/welcome',
  title: 'このブログへようこそ',
  type: 'idea',
  topics: ['blog', 'hello'],
  published: true,
  published_at: '2026-04-01T00:00:00+09:00',
  emoji: '👋',
}

/**
 * NuxtLink / 他 auto-imports の解決を回避するため、
 * 最小限の stub で mount する。
 */
const globalStubs = {
  stubs: {
    NuxtLink: {
      props: ['to'],
      template: '<a :href="String(to)"><slot /></a>',
    },
  },
}

describe('ArticleCard', () => {
  it('renders title, formatted date, and topics', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: globalStubs,
    })
    expect(wrapper.text()).toContain('このブログへようこそ')
    expect(wrapper.text()).toContain('2026-04-01')
    expect(wrapper.text()).toContain('blog')
    expect(wrapper.text()).toContain('hello')
  })

  it('renders emoji when provided', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: globalStubs,
    })
    expect(wrapper.find('.emoji').text()).toBe('👋')
  })

  it('does not render emoji span when emoji is absent', () => {
    const wrapper = mount(ArticleCard, {
      props: {
        article: { ...baseArticle, emoji: undefined },
      },
      global: globalStubs,
    })
    expect(wrapper.find('.emoji').exists()).toBe(false)
  })

  it('links to /articles/:slug', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: globalStubs,
    })
    const anchor = wrapper.find('a')
    expect(anchor.attributes('href')).toBe('/articles/welcome')
  })

  it('shows Draft badge when isDraft is true', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle, isDraft: true },
      global: globalStubs,
    })
    expect(wrapper.find('.draft-badge').exists()).toBe(true)
    expect(wrapper.find('.draft-badge').text()).toBe('Draft')
  })

  it('does not show Draft badge when isDraft is false', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle, isDraft: false },
      global: globalStubs,
    })
    expect(wrapper.find('.draft-badge').exists()).toBe(false)
  })

  it('does not show Draft badge by default', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: globalStubs,
    })
    expect(wrapper.find('.draft-badge').exists()).toBe(false)
  })

  it('does not crash with an empty topics array', () => {
    const wrapper = mount(ArticleCard, {
      props: {
        article: { ...baseArticle, topics: [] },
      },
      global: globalStubs,
    })
    expect(wrapper.find('.topics').exists()).toBe(false)
    expect(wrapper.text()).toContain('このブログへようこそ')
  })

  it('omits published-at element when published_at is undefined', () => {
    const wrapper = mount(ArticleCard, {
      props: {
        article: { ...baseArticle, published_at: undefined },
      },
      global: globalStubs,
    })
    expect(wrapper.find('.published-at').exists()).toBe(false)
  })
})
