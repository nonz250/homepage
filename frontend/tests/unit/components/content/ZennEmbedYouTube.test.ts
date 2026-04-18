import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ZennEmbedYouTube from '../../../../components/content/ZennEmbedYouTube.vue'
import {
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
  YOUTUBE_EMBED_ORIGIN,
} from '../../../../constants/zenn-embed'
import { getIframePolicy } from '../../../../config/iframe-allowlist'

/**
 * ZennEmbedYouTube は youtube-nocookie.com を src に使う iframe を描画する
 * presentational コンポーネント。テストでは以下の契約を検証する。
 *
 *   - valid な video ID で iframe が描画され、src/sandbox/allow が期待値と一致
 *   - invalid な ID では iframe を描画しない (defense in depth)
 *   - loading / referrerpolicy / title 属性が正しく付与される
 *
 * sandbox / allow はハードコードせず `getIframePolicy('youtube')` と一致する
 * ことを確認することで、iframe-allowlist を single source of truth とする
 * 契約も同時に守る。
 */
const VALID_ID = 'dQw4w9WgXcQ'

describe('ZennEmbedYouTube', () => {
  it('renders an iframe when id is valid', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: VALID_ID },
    })
    expect(wrapper.find('iframe').exists()).toBe(true)
  })

  it('uses youtube-nocookie origin for src', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: VALID_ID },
    })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('src')).toBe(
      `${YOUTUBE_EMBED_ORIGIN}/embed/${VALID_ID}`,
    )
  })

  it('applies sandbox from iframe-allowlist', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: VALID_ID },
    })
    const policy = getIframePolicy('youtube')
    expect(wrapper.find('iframe').attributes('sandbox')).toBe(policy.sandbox)
  })

  it('applies allow from iframe-allowlist', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: VALID_ID },
    })
    const policy = getIframePolicy('youtube')
    expect(wrapper.find('iframe').attributes('allow')).toBe(policy.allow)
  })

  it('sets lazy loading and referrer policy', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: VALID_ID },
    })
    const iframe = wrapper.find('iframe')
    expect(iframe.attributes('loading')).toBe(IFRAME_LOADING_LAZY)
    expect(iframe.attributes('referrerpolicy')).toBe(IFRAME_REFERRER_POLICY)
  })

  it('sets a descriptive title including the video id', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: VALID_ID },
    })
    const title = wrapper.find('iframe').attributes('title')
    expect(title).toBeTruthy()
    expect(title).toContain(VALID_ID)
  })

  it('does not render iframe when id is too short', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: 'short' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not render iframe when id is empty string', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      props: { id: '' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not render iframe when id contains disallowed characters', () => {
    const wrapper = mount(ZennEmbedYouTube, {
      // 11 文字だが `!` を含むため YOUTUBE_VIDEO_ID_PATTERN に不一致。
      props: { id: 'abc!def1234' },
    })
    expect(wrapper.find('iframe').exists()).toBe(false)
  })
})
