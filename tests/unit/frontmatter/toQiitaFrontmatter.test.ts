import { describe, expect, it } from 'vitest'
import { toQiitaFrontmatter } from '../../../scripts/lib/frontmatter/toQiitaFrontmatter'
import type { ArticleFrontmatter } from '../../../scripts/lib/schema/article'

describe('toQiitaFrontmatter', () => {
  const base: ArticleFrontmatter = {
    title: 'hello',
    emoji: '🤖',
    type: 'tech',
    topics: ['ai', 'mcp'],
    published: true,
    published_at: '2026-04-19 21:00',
    site: true,
    zenn: false,
    qiita: true,
    qiitaSlug: 'qiita-slug-xyz',
  }

  it('maps topics to tags and published to !private', () => {
    const result = toQiitaFrontmatter(base)
    expect(result.title).toBe('hello')
    expect(result.tags).toEqual(['ai', 'mcp'])
    expect(result.private).toBe(false)
    expect(result.ignorePublish).toBe(true)
  })

  it('sets private=true when published=false', () => {
    const result = toQiitaFrontmatter({ ...base, published: false })
    expect(result.private).toBe(true)
  })

  it('always forces ignorePublish=true', () => {
    const result = toQiitaFrontmatter(base)
    expect(result.ignorePublish).toBe(true)
  })

  it('merges existing qiita-only fields (id, organization_url_name, etc.)', () => {
    const result = toQiitaFrontmatter(base, {
      id: 'abcdefghijklmnop0000',
      organization_url_name: 'my-org',
      slide: true,
      updated_at: '2026-04-19T10:00:00+09:00',
    })
    expect(result.id).toBe('abcdefghijklmnop0000')
    expect(result.organization_url_name).toBe('my-org')
    expect(result.slide).toBe(true)
    expect(result.updated_at).toBe('2026-04-19T10:00:00+09:00')
  })

  it('does not introduce optional keys when existing is empty', () => {
    const result = toQiitaFrontmatter(base)
    expect('id' in result).toBe(false)
    expect('organization_url_name' in result).toBe(false)
    expect('slide' in result).toBe(false)
    expect('updated_at' in result).toBe(false)
  })
})
