import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ArticleHeader from '../../../components/parts/ArticleHeader.vue'
import type { Article } from '../../../utils/article/articleVisibility'

/**
 * ArticleHeader は詳細ページの見出し用 presentational コンポーネント。
 * 最小限の正常系 (タイトル / 日付 / topics の描画) と Draft バッジの
 * 出し分けを検証する。
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
  site: true,
  zenn: false,
  qiita: false,
}

describe('ArticleHeader', () => {
  it('renders h1 title with emoji', () => {
    const wrapper = mount(ArticleHeader, {
      props: { article: baseArticle },
    })
    const h1 = wrapper.find('h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toContain('このブログへようこそ')
    expect(h1.text()).toContain('👋')
  })

  it('renders the formatted published date', () => {
    const wrapper = mount(ArticleHeader, {
      props: { article: baseArticle },
    })
    expect(wrapper.find('.published-at').text()).toBe('2026-04-01')
  })

  it('renders topics as list items', () => {
    const wrapper = mount(ArticleHeader, {
      props: { article: baseArticle },
    })
    const items = wrapper.findAll('.topic')
    expect(items.map((i) => i.text())).toEqual(['blog', 'hello'])
  })

  it('toggles Draft badge based on isDraft prop', () => {
    const visible = mount(ArticleHeader, {
      props: { article: baseArticle, isDraft: true },
    })
    expect(visible.find('.draft-badge').exists()).toBe(true)

    const hidden = mount(ArticleHeader, {
      props: { article: baseArticle, isDraft: false },
    })
    expect(hidden.find('.draft-badge').exists()).toBe(false)
  })
})
