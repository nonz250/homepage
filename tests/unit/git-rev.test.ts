import { describe, expect, it } from 'vitest'
import {
  isCanonicalRepository,
  resolveCommitSha,
} from '../../scripts/lib/git-rev'

/**
 * git-rev adapter のテスト。
 *
 * 設計上 `CONTENT_COMMIT_SHA` が env に注入されている前提で本番経路を走らせ、
 * env が無い場合のみ `git rev-parse HEAD` にフォールバックする。
 * ユニットテストでは "env 注入あり" の純関数パスを検証する。
 * fallback 側は generator integration テストで実系を通す。
 *
 * もう 1 つの責務は fork CI 判定: `GITHUB_REPOSITORY` が `nonz250/homepage`
 * 以外なら画像 URL 生成を skip する判定に使う。
 */
describe('git-rev', () => {
  describe('resolveCommitSha', () => {
    it('returns CONTENT_COMMIT_SHA when provided', () => {
      const env = { CONTENT_COMMIT_SHA: 'abc123def456' } as NodeJS.ProcessEnv
      expect(resolveCommitSha({ env })).toBe('abc123def456')
    })

    it('does not call the fallback when env is present', () => {
      const env = { CONTENT_COMMIT_SHA: 'abc123' } as NodeJS.ProcessEnv
      let fallbackCalled = false
      resolveCommitSha({
        env,
        fallback: () => {
          fallbackCalled = true
          return 'should-not-be-used'
        },
      })
      expect(fallbackCalled).toBe(false)
    })

    it('falls back when CONTENT_COMMIT_SHA is missing', () => {
      const env = {} as NodeJS.ProcessEnv
      const resolved = resolveCommitSha({
        env,
        fallback: () => 'fallback-sha',
      })
      expect(resolved).toBe('fallback-sha')
    })

    it('trims whitespace from the fallback result', () => {
      const env = {} as NodeJS.ProcessEnv
      const resolved = resolveCommitSha({
        env,
        fallback: () => ' fallback-sha \n',
      })
      expect(resolved).toBe('fallback-sha')
    })

    it('throws when both env and fallback yield an empty string', () => {
      const env = { CONTENT_COMMIT_SHA: '   ' } as NodeJS.ProcessEnv
      expect(() =>
        resolveCommitSha({
          env,
          fallback: () => '',
        }),
      ).toThrow()
    })
  })

  describe('isCanonicalRepository', () => {
    it('returns true when GITHUB_REPOSITORY matches owner/repo', () => {
      const env = { GITHUB_REPOSITORY: 'nonz250/homepage' } as NodeJS.ProcessEnv
      expect(isCanonicalRepository({ env })).toBe(true)
    })

    it('returns false when GITHUB_REPOSITORY points to a fork', () => {
      const env = {
        GITHUB_REPOSITORY: 'someone-else/homepage',
      } as NodeJS.ProcessEnv
      expect(isCanonicalRepository({ env })).toBe(false)
    })

    it('returns true when GITHUB_REPOSITORY is missing (local dev)', () => {
      // fork CI でのみ fail-closed にしたいので、env が未設定なら canonical
      // 扱いでよい (ローカル実行向けの挙動)。
      const env = {} as NodeJS.ProcessEnv
      expect(isCanonicalRepository({ env })).toBe(true)
    })
  })
})
