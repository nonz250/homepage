import { describe, expect, it } from 'vitest'
import {
  detectSlugCollisions,
  formatSlugCollisionError,
  type SlugSourceEntry,
} from '../../../utils/prerender/detectSlugCollisions'

/**
 * `detectSlugCollisions` / `formatSlugCollisionError` の単体テスト。
 *
 * articles/ と site-articles/ を同一コレクションに統合するにあたり、
 * 同じ slug が複数ディレクトリに存在するとどちらが優先されるか不定になる。
 * ここでは純関数レベルで以下を検証する:
 *   - 衝突なし: 空配列入力・単一ソース・別 slug
 *   - 衝突あり: 2 件以上で重複した slug を抽出
 *   - 複数 slug の衝突を slug 昇順で安定化
 *   - エラーメッセージに slug と全パスが含まれる
 */
describe('detectSlugCollisions', () => {
  it('returns an empty report for an empty input', () => {
    expect(detectSlugCollisions([])).toEqual([])
  })

  it('returns an empty report when slugs are unique across sources', () => {
    const entries: SlugSourceEntry[] = [
      { slug: 'hello', absPath: '/repo/articles/hello.md' },
      { slug: 'about', absPath: '/repo/site-articles/about.md' },
    ]
    expect(detectSlugCollisions(entries)).toEqual([])
  })

  it('detects a single slug collision across two directories', () => {
    const entries: SlugSourceEntry[] = [
      { slug: 'hello', absPath: '/repo/articles/hello.md' },
      { slug: 'hello', absPath: '/repo/site-articles/hello.md' },
    ]
    expect(detectSlugCollisions(entries)).toEqual([
      {
        slug: 'hello',
        paths: ['/repo/articles/hello.md', '/repo/site-articles/hello.md'],
      },
    ])
  })

  it('reports multiple collisions sorted by slug ascending', () => {
    const entries: SlugSourceEntry[] = [
      { slug: 'beta', absPath: '/repo/articles/beta.md' },
      { slug: 'alpha', absPath: '/repo/articles/alpha.md' },
      { slug: 'alpha', absPath: '/repo/site-articles/alpha.md' },
      { slug: 'beta', absPath: '/repo/site-articles/beta.md' },
      { slug: 'gamma', absPath: '/repo/articles/gamma.md' },
    ]
    const report = detectSlugCollisions(entries)
    expect(report).toEqual([
      {
        slug: 'alpha',
        paths: ['/repo/articles/alpha.md', '/repo/site-articles/alpha.md'],
      },
      {
        slug: 'beta',
        paths: ['/repo/articles/beta.md', '/repo/site-articles/beta.md'],
      },
    ])
  })

  it('detects more than two conflicting entries for the same slug', () => {
    const entries: SlugSourceEntry[] = [
      { slug: 'dup', absPath: '/a/dup.md' },
      { slug: 'dup', absPath: '/b/dup.md' },
      { slug: 'dup', absPath: '/c/dup.md' },
    ]
    expect(detectSlugCollisions(entries)).toEqual([
      {
        slug: 'dup',
        paths: ['/a/dup.md', '/b/dup.md', '/c/dup.md'],
      },
    ])
  })
})

describe('formatSlugCollisionError', () => {
  it('returns an empty string for an empty report', () => {
    expect(formatSlugCollisionError([])).toBe('')
  })

  it('includes the slug and every conflicting path in the message', () => {
    const message = formatSlugCollisionError([
      {
        slug: 'hello',
        paths: ['/repo/articles/hello.md', '/repo/site-articles/hello.md'],
      },
    ])
    expect(message).toContain(
      'articles slug collision detected between source directories',
    )
    expect(message).toContain('slug: hello')
    expect(message).toContain('/repo/articles/hello.md')
    expect(message).toContain('/repo/site-articles/hello.md')
  })
})
