import { describe, expect, it } from 'vitest'
import {
  extractGistUserId,
  extractTweetId,
  validateCardUrl,
  validateCodePenPath,
  validateCodeSandboxId,
  validateGistUrl,
  validateStackBlitzPath,
  validateTweetUrl,
  validateYouTubeVideoId,
} from '../../../utils/markdown/validateEmbedId'
import { CARD_URL_MAX_LENGTH } from '../../../constants/zenn-embed'

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

describe('validateCardUrl', () => {
  describe('valid cases', () => {
    it('accepts a canonical https URL', () => {
      const result = validateCardUrl('https://example.com/article')
      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('accepts http on port 80 (implicit)', () => {
      const result = validateCardUrl('http://example.com/')
      expect(result.valid).toBe(true)
    })

    it('accepts URLs with query strings and fragments', () => {
      const result = validateCardUrl('https://example.com/p?a=1&b=2#h')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty string', () => {
      const result = validateCardUrl('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('non-empty')
    })

    it('rejects javascript: scheme', () => {
      // eslint-disable-next-line no-script-url
      const result = validateCardUrl('javascript:alert(1)')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('scheme')
    })

    it('rejects data: URL', () => {
      const result = validateCardUrl('data:text/html,<h1>x</h1>')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('scheme')
    })

    it('rejects file: URL', () => {
      const result = validateCardUrl('file:///etc/passwd')
      expect(result.valid).toBe(false)
    })

    it('rejects URLs with disallowed port', () => {
      const result = validateCardUrl('https://example.com:22/')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('port')
    })

    it('rejects URLs longer than max length', () => {
      const longUrl = `https://example.com/${'a'.repeat(CARD_URL_MAX_LENGTH + 100)}`
      const result = validateCardUrl(longUrl)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('exceeds max length')
    })

    it('rejects unparsable input', () => {
      const result = validateCardUrl('not a url')
      expect(result.valid).toBe(false)
    })
  })
})

describe('extractTweetId / validateTweetUrl', () => {
  describe('valid cases', () => {
    it('extracts a 19-digit snowflake ID from twitter.com URL', () => {
      const id = extractTweetId('https://twitter.com/user/status/1234567890123456789')
      expect(id).toBe('1234567890123456789')
      const validation = validateTweetUrl('https://twitter.com/user/status/1234567890123456789')
      expect(validation.valid).toBe(true)
    })

    it('extracts ID from x.com URL (new domain)', () => {
      expect(extractTweetId('https://x.com/user/status/987654321')).toBe('987654321')
      expect(validateTweetUrl('https://x.com/user/status/987654321').valid).toBe(true)
    })

    it('extracts ID with www. subdomain', () => {
      expect(extractTweetId('https://www.twitter.com/user/status/1')).toBe('1')
      expect(extractTweetId('https://www.x.com/user/status/1')).toBe('1')
    })

    it('ignores trailing segments and query strings', () => {
      expect(
        extractTweetId('https://twitter.com/user/status/1234567890/photo/1?s=20'),
      ).toBe('1234567890')
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty string', () => {
      expect(extractTweetId('')).toBeNull()
      const result = validateTweetUrl('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('non-empty')
    })

    it('rejects raw ID without URL', () => {
      // 素の ID 文字列 (`1234567890`) は本 validator では受け付けない。
      expect(extractTweetId('1234567890')).toBeNull()
      const result = validateTweetUrl('1234567890')
      expect(result.valid).toBe(false)
    })

    it('rejects invalid host', () => {
      expect(
        extractTweetId('https://evil.example.com/user/status/1234567890'),
      ).toBeNull()
      const result = validateTweetUrl(
        'https://evil.example.com/user/status/1234567890',
      )
      expect(result.valid).toBe(false)
    })

    it('rejects ID exceeding 25 digits', () => {
      const overflow = '1'.repeat(26)
      expect(extractTweetId(`https://twitter.com/u/status/${overflow}`)).toBeNull()
    })

    it('rejects non-digit ID', () => {
      expect(
        extractTweetId('https://twitter.com/user/status/abc123'),
      ).toBeNull()
    })

    it('rejects URLs without /status/<id>', () => {
      expect(extractTweetId('https://twitter.com/user')).toBeNull()
      expect(extractTweetId('https://twitter.com/user/statuses/1')).toBeNull()
    })

    it('rejects non-http scheme', () => {
      // eslint-disable-next-line no-script-url
      expect(extractTweetId('javascript:alert(1)')).toBeNull()
    })
  })
})

describe('extractGistUserId / validateGistUrl', () => {
  describe('valid cases', () => {
    it('extracts user and id from canonical Gist URL', () => {
      const extracted = extractGistUserId(
        'https://gist.github.com/nonz250/abcdef1234567890abcdef1234567890',
      )
      expect(extracted).not.toBeNull()
      expect(extracted?.user).toBe('nonz250')
      expect(extracted?.id).toBe('abcdef1234567890abcdef1234567890')
      const validation = validateGistUrl(
        'https://gist.github.com/nonz250/abcdef1234567890abcdef1234567890',
      )
      expect(validation.valid).toBe(true)
    })

    it('accepts 20-char (legacy short) hash', () => {
      const extracted = extractGistUserId(
        'https://gist.github.com/u/abcdef1234567890abcd',
      )
      expect(extracted?.id).toBe('abcdef1234567890abcd')
    })

    it('accepts 40-char full sha1 hash', () => {
      const full = 'a'.repeat(40)
      const extracted = extractGistUserId(
        `https://gist.github.com/u/${full}`,
      )
      expect(extracted?.id).toBe(full)
    })

    it('ignores trailing revision segments', () => {
      const extracted = extractGistUserId(
        'https://gist.github.com/nonz250/abcdef1234567890abcdef1234567890/revisions',
      )
      expect(extracted?.id).toBe('abcdef1234567890abcdef1234567890')
    })
  })

  describe('invalid cases', () => {
    it('rejects an empty string', () => {
      expect(extractGistUserId('')).toBeNull()
      const result = validateGistUrl('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('non-empty')
    })

    it('rejects raw path without URL scheme', () => {
      expect(extractGistUserId('user/abcdef1234567890abcd')).toBeNull()
      expect(validateGistUrl('user/abcdef1234567890abcd').valid).toBe(false)
    })

    it('rejects invalid host', () => {
      expect(
        extractGistUserId('https://example.com/u/abcdef1234567890abcd'),
      ).toBeNull()
    })

    it('rejects invalid user (leading hyphen)', () => {
      expect(
        extractGistUserId('https://gist.github.com/-user/abcdef1234567890abcd'),
      ).toBeNull()
    })

    it('rejects invalid user (trailing hyphen)', () => {
      expect(
        extractGistUserId('https://gist.github.com/user-/abcdef1234567890abcd'),
      ).toBeNull()
    })

    it('rejects invalid id (uppercase hex)', () => {
      expect(
        extractGistUserId('https://gist.github.com/u/ABCDEF1234567890ABCD'),
      ).toBeNull()
    })

    it('rejects invalid id (too short)', () => {
      expect(
        extractGistUserId('https://gist.github.com/u/abcdef12345'),
      ).toBeNull()
    })

    it('rejects URLs missing id segment', () => {
      expect(extractGistUserId('https://gist.github.com/nonz250')).toBeNull()
    })

    it('rejects non-http scheme', () => {
      // eslint-disable-next-line no-script-url
      expect(extractGistUserId('javascript:alert(1)')).toBeNull()
    })
  })
})
