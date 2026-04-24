import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TheHeader from '../../../components/TheHeader.vue'

/**
 * TheHeader のナビゲーション構造を検証する。
 *
 * Issue #57 で "Blog" メニュー項目は削除済み。過去リグレッションで
 * 再追加されると Issue #57 の期待状態が壊れるため、ここでナビ項目の
 * 現状を unit test として固定しておく。
 */
const globalStubs = {
  stubs: {
    NuxtLink: {
      props: ['to'],
      template: '<a :href="String(to)"><slot /></a>',
    },
    Anchor: {
      props: ['link', 'shine'],
      template: '<a :href="String(link)"><slot /></a>',
    },
    FontAwesomeIcon: {
      template: '<i />',
    },
  },
}

describe('TheHeader', () => {
  it('renders the expected navigation labels (Blog excluded)', () => {
    const wrapper = mount(TheHeader, { global: globalStubs })
    const text = wrapper.text()
    expect(text).toContain('About')
    expect(text).toContain('Service')
    expect(text).toContain('Works')
    expect(text).toContain('Articles')
    expect(text).toContain('Contact')
    expect(text).not.toContain('Blog')
  })

  it('does not link to the external labo.nozomi.bike site from the header', () => {
    const wrapper = mount(TheHeader, { global: globalStubs })
    const anchors = wrapper.findAll('a')
    for (const a of anchors) {
      expect(a.attributes('href') ?? '').not.toContain('labo.nozomi.bike')
    }
  })
})
