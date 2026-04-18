import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZennEmbedStackBlitz from '../../../../components/content/ZennEmbedStackBlitz.vue'
import {
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
  STACKBLITZ_EMBED_ORIGIN,
} from '../../../../constants/zenn-embed'
import { getIframePolicy } from '../../../../config/iframe-allowlist'

/**
 * ZennEmbedStackBlitz は StackBlitz 埋め込み iframe を描画する。
 *
 * `edit/<project>` と `github/<owner>/<repo>` の 2 形式を許可。
 */
const EDIT_ID = 'edit/vite-hello'
const GITHUB_ID = 'github/user/repo'

describe('ZennEmbedStackBlitz', () => {
  it('renders an iframe for edit/* id', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      props: { id: EDIT_ID },
    })
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('renders an iframe for github/* id', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      props: { id: GITHUB_ID },
    })
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('appends ?embed=1 to src', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      props: { id: EDIT_ID },
    })
    expect(wrapper.find('iframe').attributes('src')).toBe(
      `${STACKBLITZ_EMBED_ORIGIN}/${EDIT_ID}?embed=1`,
    )
  })

  it('applies sandbox and allow from iframe-allowlist', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      props: { id: EDIT_ID },
    })
    const policy = getIframePolicy('stackblitz')
    expect(wrapper.find('iframe').attributes('sandbox')).toBe(policy.sandbox)
    expect(wrapper.find('iframe').attributes('allow')).toBe(policy.allow)
  })

  it('sets lazy loading and referrer policy', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      props: { id: EDIT_ID },
    })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('loading')).toBe(IFRAME_LOADING_LAZY)
    expect(iframe.attributes('referrerpolicy')).toBe(IFRAME_REFERRER_POLICY)
  })

  it('sets a descriptive title that includes the id', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      props: { id: EDIT_ID },
    })
    const title = wrapper.find('iframe').attributes('title')
    expect(title).toBeTruthy()
    expect(title).toContain(EDIT_ID)
  })

  it('does not render iframe when id has unknown prefix', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      // `projects/*` は validator で拒否される。
      props: { id: 'projects/foo' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not render iframe when id is empty', () => {
    const wrapper = mount(ZennEmbedStackBlitz, {
      props: { id: '' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })
})
