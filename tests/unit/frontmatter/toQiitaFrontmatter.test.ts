import { describe, expect, it } from 'vitest'
import { toQiitaFrontmatter } from '../../../scripts/lib/frontmatter/toQiitaFrontmatter'
import { fixedClock } from '../../../scripts/lib/clock'
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

  // 2026-04-19 21:00 JST = 2026-04-19 12:00 UTC。ここより後の瞬間 = 過去扱い。
  const clockAfterBase = fixedClock('2026-04-19T13:00:00Z')
  // 2026-04-19 21:00 JST の直前 = 未来扱い。
  const clockBeforeBase = fixedClock('2026-04-19T11:59:00Z')

  it('maps topics to tags and published to !private', () => {
    const result = toQiitaFrontmatter(base, {}, clockAfterBase)
    expect(result.title).toBe('hello')
    expect(result.tags).toEqual(['ai', 'mcp'])
    expect(result.private).toBe(false)
  })

  it('sets private=true when published=false', () => {
    const result = toQiitaFrontmatter(
      { ...base, published: false },
      {},
      clockAfterBase,
    )
    expect(result.private).toBe(true)
  })

  it('sets ignorePublish=false when qiita=true, published=true, and past published_at', () => {
    const result = toQiitaFrontmatter(base, {}, clockAfterBase)
    expect(result.ignorePublish).toBe(false)
  })

  it('sets ignorePublish=true when qiita=true, published=true, but future published_at', () => {
    const result = toQiitaFrontmatter(base, {}, clockBeforeBase)
    expect(result.ignorePublish).toBe(true)
  })

  it('sets ignorePublish=true when qiita=true but published=false', () => {
    const result = toQiitaFrontmatter(
      { ...base, published: false },
      {},
      clockAfterBase,
    )
    expect(result.ignorePublish).toBe(true)
  })

  it('sets ignorePublish=true defensively when qiita=false', () => {
    const result = toQiitaFrontmatter(
      { ...base, qiita: false },
      {},
      clockAfterBase,
    )
    expect(result.ignorePublish).toBe(true)
  })

  it('merges existing qiita-only fields (id, organization_url_name, etc.)', () => {
    const result = toQiitaFrontmatter(
      base,
      {
        id: 'abcdefghijklmnop0000',
        organization_url_name: 'my-org',
        slide: true,
        updated_at: '2026-04-19T10:00:00+09:00',
      },
      clockAfterBase,
    )
    expect(result.id).toBe('abcdefghijklmnop0000')
    expect(result.organization_url_name).toBe('my-org')
    expect(result.slide).toBe(true)
    expect(result.updated_at).toBe('2026-04-19T10:00:00+09:00')
  })

  it('fills required qiita keys with defaults when existing is empty (qiita-cli v0.5.0+ compliance)', () => {
    // qiita-cli v0.5.0 以降は updated_at / id / organization_url_name / slide
    // を必須バリデートする。merge 元が無くても空文字列 / false で埋めないと
    // qiita preview と publish が validation エラーで落ちる。
    const result = toQiitaFrontmatter(base, {}, clockAfterBase)
    expect(result.id).toBe('')
    expect(result.organization_url_name).toBe('')
    expect(result.slide).toBe(false)
    expect(result.updated_at).toBe('')
  })
})
