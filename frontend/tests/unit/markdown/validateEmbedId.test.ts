import { describe, expect, it } from 'vitest'
import {
  validateCodePenPath,
  validateCodeSandboxId,
  validateStackBlitzPath,
  validateYouTubeVideoId,
} from '../../../utils/markdown/validateEmbedId'

/**
 * `validateEmbedId.ts` 各関数の単体テスト。
 *
 * 正常系: 実在する or 仕様上正当なサンプル文字列で `valid: true` となることを
 * 確認する。
 * 異常系: 空文字、長さ超過 / 不足、不正な文字種、フォーマット違反などで
 * `valid: false` になり、`reason` に人間可読の理由が入ることを確認する。
 *
 * これらのバリデータは「build fail の根拠」になるため、invalid 判定の
 * 具体性がそのまま運用時のデバッグ効率に直結する。
 */

describe('validateYouTubeVideoId', () => {
  describe('valid cases', () => {
    it('accepts a canonical 11-character video ID', () => {
      // Rick Astley の公式 MV ID。実在し、YouTube の 11 文字仕様を満たす。
      const result = validateYouTubeVideoId('dQw4w9WgXcQ')
      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('accepts IDs containing underscores and dashes', () => {
      const result = validateYouTubeVideoId('A_BcDe-FgHi')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty string', () => {
      const result = validateYouTubeVideoId('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('non-empty')
    })

    it('rejects IDs shorter than 11 characters', () => {
      const result = validateYouTubeVideoId('short')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('11 characters')
    })

    it('rejects IDs longer than 11 characters', () => {
      const result = validateYouTubeVideoId('dQw4w9WgXcQX')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('11 characters')
    })

    it('rejects IDs with forbidden characters', () => {
      const result = validateYouTubeVideoId('dQw4w9WgXc!')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('11 characters')
    })
  })
})

describe('validateCodePenPath', () => {
  describe('valid cases', () => {
    it('accepts <user>/pen/<id> form', () => {
      const result = validateCodePenPath('chriscoyier/pen/Abc123')
      expect(result.valid).toBe(true)
    })

    it('accepts <user>/embed/<id> form', () => {
      const result = validateCodePenPath('chris_coyier/embed/aBcDeF')
      expect(result.valid).toBe(true)
    })

    it('accepts user names with dashes and underscores', () => {
      const result = validateCodePenPath('user-name_01/pen/wxyz12')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty string', () => {
      const result = validateCodePenPath('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('non-empty')
    })

    it('rejects unknown middle segment', () => {
      const result = validateCodePenPath('user/other/abc123')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('pen')
    })

    it('rejects paths missing the middle segment', () => {
      const result = validateCodePenPath('user/abc123')
      expect(result.valid).toBe(false)
    })

    it('rejects IDs with forbidden characters', () => {
      const result = validateCodePenPath('user/pen/abc!23')
      expect(result.valid).toBe(false)
    })
  })
})

describe('validateCodeSandboxId', () => {
  describe('valid cases', () => {
    it('accepts a bare sandbox ID', () => {
      const result = validateCodeSandboxId('new-wbxyz')
      expect(result.valid).toBe(true)
    })

    it('accepts s/<id> form', () => {
      const result = validateCodeSandboxId('s/new-wbxyz')
      expect(result.valid).toBe(true)
    })

    it('accepts IDs with dashes and underscores', () => {
      const result = validateCodeSandboxId('s/abc_DEF-123')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty string', () => {
      const result = validateCodeSandboxId('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('non-empty')
    })

    it('rejects s/ with empty ID', () => {
      const result = validateCodeSandboxId('s/')
      expect(result.valid).toBe(false)
    })

    it('rejects IDs exceeding 40 chars', () => {
      const result = validateCodeSandboxId('a'.repeat(41))
      expect(result.valid).toBe(false)
    })

    it('rejects IDs with forbidden characters', () => {
      const result = validateCodeSandboxId('abc/def')
      expect(result.valid).toBe(false)
    })
  })
})

describe('validateStackBlitzPath', () => {
  describe('valid cases', () => {
    it('accepts edit/<project>', () => {
      const result = validateStackBlitzPath('edit/vue-hello-world')
      expect(result.valid).toBe(true)
    })

    it('accepts github/<owner>/<repo>', () => {
      const result = validateStackBlitzPath('github/stackblitz/core')
      expect(result.valid).toBe(true)
    })

    it('accepts github owner/repo with dashes and underscores', () => {
      const result = validateStackBlitzPath('github/some-owner/some_repo-1')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty string', () => {
      const result = validateStackBlitzPath('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('non-empty')
    })

    it('rejects unknown root segment', () => {
      const result = validateStackBlitzPath('fork/my-project')
      expect(result.valid).toBe(false)
    })

    it('rejects edit/ paths exceeding 60 chars', () => {
      const result = validateStackBlitzPath(`edit/${'a'.repeat(61)}`)
      expect(result.valid).toBe(false)
    })

    it('rejects github paths missing repo', () => {
      const result = validateStackBlitzPath('github/stackblitz')
      expect(result.valid).toBe(false)
    })
  })
})
