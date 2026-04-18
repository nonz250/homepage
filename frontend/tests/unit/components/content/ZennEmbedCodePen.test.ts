import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZennEmbedCodePen from '../../../../components/content/ZennEmbedCodePen.vue'
import {
  CODEPEN_EMBED_ORIGIN,
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
} from '../../../../constants/zenn-embed'
import { getIframePolicy } from '../../../../config/iframe-allowlist'

/**
 * ZennEmbedCodePen は CodePen 埋め込み iframe を描画する。
 *
 * sandbox/allow は `getIframePolicy('codepen')` と一致し、invalid な ID では
 * 何も描画しない (defense in depth)。
 */
const VALID_ID = 'nonz250/pen/abcDEF01'

describe('ZennEmbedCodePen', () => {
  it('renders an iframe when id is valid', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      props: { id: VALID_ID },
    })
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('builds src from origin and id path', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      props: { id: VALID_ID },
    })
    expect(wrapper.find('iframe').attributes('src')).toBe(
      `${CODEPEN_EMBED_ORIGIN}/${VALID_ID}`,
    )
  })

  it('applies sandbox and allow from iframe-allowlist', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      props: { id: VALID_ID },
    })
    const policy = getIframePolicy('codepen')
    expect(wrapper.find('iframe').attributes('sandbox')).toBe(policy.sandbox)
    expect(wrapper.find('iframe').attributes('allow')).toBe(policy.allow)
  })

  it('sets lazy loading and referrer policy', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      props: { id: VALID_ID },
    })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('loading')).toBe(IFRAME_LOADING_LAZY)
    expect(iframe.attributes('referrerpolicy')).toBe(IFRAME_REFERRER_POLICY)
  })

  it('sets a descriptive title that includes the id', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      props: { id: VALID_ID },
    })
    const title = wrapper.find('iframe').attributes('title')
    expect(title).toBeTruthy()
    expect(title).toContain(VALID_ID)
  })

  it('does not render iframe when id path is invalid format', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      // `pen` 以外の中央セグメントは validator で弾かれる。
      props: { id: 'nonz250/unknown/abc' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not render iframe when id is empty', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      props: { id: '' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not render iframe when id has no user segment', () => {
    const wrapper = mount(ZennEmbedCodePen, {
      props: { id: 'pen/abcDEF01' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })
})
