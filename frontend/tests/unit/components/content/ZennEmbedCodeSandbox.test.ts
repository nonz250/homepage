import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZennEmbedCodeSandbox from '../../../../components/content/ZennEmbedCodeSandbox.vue'
import {
  CODESANDBOX_EMBED_ORIGIN,
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
} from '../../../../constants/zenn-embed'
import { getIframePolicy } from '../../../../config/iframe-allowlist'

/**
 * ZennEmbedCodeSandbox は CodeSandbox 埋め込み iframe を描画する。
 *
 * sandbox ID は英数字 / `_` / `-` を想定し、invalid なら iframe 非描画。
 */
const VALID_ID = 'new-sandbox-xyz123'

describe('ZennEmbedCodeSandbox', () => {
  it('renders an iframe when id is valid', () => {
    const wrapper = mount(ZennEmbedCodeSandbox, {
      props: { id: VALID_ID },
    })
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('builds src with /embed/ prefix', () => {
    const wrapper = mount(ZennEmbedCodeSandbox, {
      props: { id: VALID_ID },
    })
    expect(wrapper.find('iframe').attributes('src')).toBe(
      `${CODESANDBOX_EMBED_ORIGIN}/embed/${VALID_ID}`,
    )
  })

  it('applies sandbox and allow from iframe-allowlist', () => {
    const wrapper = mount(ZennEmbedCodeSandbox, {
      props: { id: VALID_ID },
    })
    const policy = getIframePolicy('codesandbox')
    expect(wrapper.find('iframe').attributes('sandbox')).toBe(policy.sandbox)
    expect(wrapper.find('iframe').attributes('allow')).toBe(policy.allow)
  })

  it('sets lazy loading and referrer policy', () => {
    const wrapper = mount(ZennEmbedCodeSandbox, {
      props: { id: VALID_ID },
    })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('loading')).toBe(IFRAME_LOADING_LAZY)
    expect(iframe.attributes('referrerpolicy')).toBe(IFRAME_REFERRER_POLICY)
  })

  it('sets a descriptive title that includes the id', () => {
    const wrapper = mount(ZennEmbedCodeSandbox, {
      props: { id: VALID_ID },
    })
    const title = wrapper.find('iframe').attributes('title')
    expect(title).toBeTruthy()
    expect(title).toContain(VALID_ID)
  })

  it('does not render iframe when id is empty', () => {
    const wrapper = mount(ZennEmbedCodeSandbox, {
      props: { id: '' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not render iframe when id contains disallowed characters', () => {
    const wrapper = mount(ZennEmbedCodeSandbox, {
      // `/` や `$` は許容文字種外。
      props: { id: 'bad$id' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not render iframe when id exceeds max length', () => {
    // 41 文字 (上限 40 を超える) は validator で拒否される。
    const tooLong = 'a'.repeat(41)
    const wrapper = mount(ZennEmbedCodeSandbox, {
      props: { id: tooLong },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })
})
