import { describe, expect, it } from 'vitest'
import {
  deriveBasenameSlug,
  detectSlugCollisions,
} from '../../scripts/lib/slug'

/**
 * slug 関連の純関数テスト。
 *
 * - deriveBasenameSlug: `site-articles/YYYY-MM-DD-foo-bar.md` のような入力
 *   から拡張子を剥がした basename を返す (パス区切りを含まないことを保証)。
 * - detectSlugCollisions: 同一 slug が複数回出現したら throw。エラーメッセージに
 *   衝突した slug 名と出所 (source path) を列挙して運用性を確保する。
 */
describe('slug utilities', () => {
  describe('deriveBasenameSlug', () => {
    it('strips the .md extension and directory prefix', () => {
      expect(deriveBasenameSlug('site-articles/2026-04-19-ai-rotom-tech.md')).toBe(
        '2026-04-19-ai-rotom-tech',
      )
    })

    it('handles plain basename without a directory', () => {
      expect(deriveBasenameSlug('hello-world.md')).toBe('hello-world')
    })

    it('throws when the path does not end with .md', () => {
      expect(() => deriveBasenameSlug('site-articles/foo.txt')).toThrow()
    })

    it('throws when the basename is empty after stripping extension', () => {
      expect(() => deriveBasenameSlug('site-articles/.md')).toThrow()
    })
  })

  describe('detectSlugCollisions', () => {
    it('does nothing when all slugs are unique', () => {
      expect(() =>
        detectSlugCollisions([
          { slug: 'foo', source: 'a.md' },
          { slug: 'bar', source: 'b.md' },
        ]),
      ).not.toThrow()
    })

    it('throws when two inputs map to the same slug', () => {
      expect(() =>
        detectSlugCollisions([
          { slug: 'dup', source: 'a.md' },
          { slug: 'dup', source: 'b.md' },
        ]),
      ).toThrow(/dup/)
    })

    it('reports all conflicting sources in the error message', () => {
      let captured: Error | null = null
      try {
        detectSlugCollisions([
          { slug: 'dup', source: 'one.md' },
          { slug: 'dup', source: 'two.md' },
          { slug: 'dup', source: 'three.md' },
        ])
      } catch (error) {
        captured = error as Error
      }
      expect(captured).not.toBeNull()
      expect(captured?.message).toContain('one.md')
      expect(captured?.message).toContain('two.md')
      expect(captured?.message).toContain('three.md')
    })

    it('tolerates empty input', () => {
      expect(() => detectSlugCollisions([])).not.toThrow()
    })
  })
})
