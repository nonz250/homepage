import { describe, expect, it } from 'vitest'
import {
  getIframePolicy,
  listIframeOrigins,
  UNKNOWN_IFRAME_SERVICE_ERROR_PREFIX,
  type IframeService,
} from '../../../config/iframe-allowlist'
import {
  CODEPEN_EMBED_ORIGIN,
  CODESANDBOX_EMBED_ORIGIN,
  STACKBLITZ_EMBED_ORIGIN,
  YOUTUBE_EMBED_ORIGIN,
} from '../../../constants/zenn-embed'

/**
 * `config/iframe-allowlist` の単体テスト。
 *
 * 設計 v4 の「iframe sandbox ホスト別ポリシー」表と 1:1 で照合し、
 * 値の変更がレビューなしに行われないよう固定する。各サービスに対し
 *   - origin が constants の定数と一致すること
 *   - sandbox が表記載のフラグ列と完全一致すること
 *   - allow が表記載の値と完全一致すること
 * を検証する。加えて未知のサービス名では throw することも確認する。
 */
describe('iframe-allowlist', () => {
  describe('getIframePolicy', () => {
    it('returns the youtube policy with nocookie origin and expected sandbox/allow', () => {
      const policy = getIframePolicy('youtube')
      expect(policy.service).toBe('youtube')
      expect(policy.origin).toBe(YOUTUBE_EMBED_ORIGIN)
      expect(policy.sandbox).toBe(
        'allow-scripts allow-same-origin allow-presentation',
      )
      expect(policy.allow).toBe(
        'encrypted-media; picture-in-picture; fullscreen',
      )
    })

    it('returns the codepen policy with code-sandbox flags and no allow', () => {
      const policy = getIframePolicy('codepen')
      expect(policy.service).toBe('codepen')
      expect(policy.origin).toBe(CODEPEN_EMBED_ORIGIN)
      expect(policy.sandbox).toBe(
        'allow-scripts allow-same-origin allow-forms allow-popups',
      )
      expect(policy.allow).toBe('')
    })

    it('returns the codesandbox policy with code-sandbox flags and no allow', () => {
      const policy = getIframePolicy('codesandbox')
      expect(policy.service).toBe('codesandbox')
      expect(policy.origin).toBe(CODESANDBOX_EMBED_ORIGIN)
      expect(policy.sandbox).toBe(
        'allow-scripts allow-same-origin allow-forms allow-popups',
      )
      expect(policy.allow).toBe('')
    })

    it('returns the stackblitz policy with code-sandbox flags and no allow', () => {
      const policy = getIframePolicy('stackblitz')
      expect(policy.service).toBe('stackblitz')
      expect(policy.origin).toBe(STACKBLITZ_EMBED_ORIGIN)
      expect(policy.sandbox).toBe(
        'allow-scripts allow-same-origin allow-forms allow-popups',
      )
      expect(policy.allow).toBe('')
    })

    it('throws for an unknown service name', () => {
      // 故意に未登録のサービス名を渡し fail-closed で throw することを確認する。
      expect(() =>
        getIframePolicy('evil' as IframeService),
      ).toThrowError(UNKNOWN_IFRAME_SERVICE_ERROR_PREFIX)
    })

    it('includes the offending service name in the error message', () => {
      expect(() =>
        getIframePolicy('malicious' as IframeService),
      ).toThrowError(/malicious/)
    })
  })

  describe('listIframeOrigins', () => {
    it('returns all four registered iframe origins', () => {
      const origins = listIframeOrigins()
      expect(origins).toHaveLength(4)
      expect(origins).toContain(YOUTUBE_EMBED_ORIGIN)
      expect(origins).toContain(CODEPEN_EMBED_ORIGIN)
      expect(origins).toContain(CODESANDBOX_EMBED_ORIGIN)
      expect(origins).toContain(STACKBLITZ_EMBED_ORIGIN)
    })

    it('returns an array with no duplicates', () => {
      const origins = listIframeOrigins()
      const unique = new Set(origins)
      expect(unique.size).toBe(origins.length)
    })
  })
})
