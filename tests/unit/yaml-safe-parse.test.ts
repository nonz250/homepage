import { describe, expect, it } from 'vitest'
import {
  assertWriteIntegrity,
  safeParseFrontmatterBlock,
} from '../../scripts/lib/yaml-safe-parse'

/**
 * yaml-safe-parse の独立 re-parse assert テスト。
 *
 * 本モジュールは gray-matter とは別経路 (js-yaml FAILSAFE_SCHEMA) で
 * frontmatter を parse することで、パーサ依存の脆弱性を回避しつつ
 * "書き込み済みファイルが期待通りの YAML 構造になっているか" を独立検証する。
 *
 * FAILSAFE_SCHEMA を使う狙い:
 *   - `!!js/function` 等の危険な YAML タグを reject する
 *   - `true` / `false` がそのまま文字列として読まれるため、数値や真偽値は
 *     パース後に明示的に比較すること
 */
describe('yaml-safe-parse', () => {
  describe('safeParseFrontmatterBlock', () => {
    it('parses a minimal well-formed YAML frontmatter block', () => {
      const yaml = 'title: "hello"\npublished: true\n'
      const result = safeParseFrontmatterBlock(yaml)
      // FAILSAFE_SCHEMA は bool/number も文字列として読む方針。
      expect(result.title).toBe('hello')
      expect(result.published).toBe('true')
    })

    it('returns the raw topics list as string array', () => {
      const yaml = 'topics:\n  - ai\n  - typescript\n'
      const result = safeParseFrontmatterBlock(yaml)
      expect(result.topics).toEqual(['ai', 'typescript'])
    })

    it('throws when YAML has a syntax error', () => {
      expect(() => safeParseFrontmatterBlock('title: "\nbroken')).toThrow()
    })

    it('throws when YAML contains a disallowed custom tag', () => {
      const yaml = 'value: !!js/function "function(){}"\n'
      expect(() => safeParseFrontmatterBlock(yaml)).toThrow()
    })

    it('returns an empty object for empty input', () => {
      expect(safeParseFrontmatterBlock('')).toEqual({})
    })
  })

  describe('assertWriteIntegrity', () => {
    const expectedKeys = {
      title: 'hello',
      published: 'true',
    }

    it('passes when every expected key matches', () => {
      const body = '---\ntitle: "hello"\npublished: true\n---\n\nbody\n'
      expect(() => assertWriteIntegrity(body, expectedKeys)).not.toThrow()
    })

    it('throws when an expected key is missing', () => {
      const body = '---\ntitle: "hello"\n---\n\nbody\n'
      expect(() => assertWriteIntegrity(body, expectedKeys)).toThrow(
        /published/,
      )
    })

    it('throws when an expected key has a different value', () => {
      const body = '---\ntitle: "goodbye"\npublished: true\n---\n\nbody\n'
      expect(() => assertWriteIntegrity(body, expectedKeys)).toThrow(/title/)
    })

    it('throws when the body does not start with a frontmatter delimiter', () => {
      expect(() =>
        assertWriteIntegrity('no-frontmatter\n', expectedKeys),
      ).toThrow(/delimiter/)
    })

    it('throws when the frontmatter is not terminated', () => {
      expect(() =>
        assertWriteIntegrity('---\ntitle: "hello"\n', expectedKeys),
      ).toThrow(/terminator/)
    })
  })
})
