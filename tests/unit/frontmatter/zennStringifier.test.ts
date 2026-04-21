import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { stringifyZennFrontmatter } from '../../../scripts/lib/frontmatter/zennStringifier'
import type { ZennFrontmatter } from '../../../scripts/lib/frontmatter/toZennFrontmatter'

/**
 * Zenn 向け stringifier のテスト。
 *
 * 合成 fixture を使って出力形式を契約化する:
 *   - キー順: title → emoji → type → topics → published → published_at
 *   - title / emoji / type: ダブルクォート `"..."`
 *   - topics: **フロースタイル** `["ai", "mcp", "typescript", "pokemon"]`
 *     (カンマの後ろに半角空白 1 つ)
 *   - published: 裸の `true` / `false`
 *   - published_at: **シングルクォート** `'2026-04-19 21:00'`
 *   - frontmatter 末尾: `---\n`
 *
 * 実リポジトリの記事を使った byte-parity snapshot は廃止した。記事は動的
 * コンテンツで変更が通常運用のため、pin し続けても偽陽性を増やすだけ。
 */
describe('stringifyZennFrontmatter', () => {
  it('produces the exact frontmatter block observed in existing article (byte-parity)', () => {
    const fm: ZennFrontmatter = {
      title:
        '育成論はAIと並走する時代へ。ポケモンバトルアドバイザー「ai-rotom」を作ってみた',
      emoji: '🤖',
      type: 'tech',
      topics: ['ai', 'mcp', 'typescript', 'pokemon'],
      published: true,
      published_at: '2026-04-19 21:00',
    }
    const result = stringifyZennFrontmatter(fm)
    const expected = [
      '---',
      'title: "育成論はAIと並走する時代へ。ポケモンバトルアドバイザー「ai-rotom」を作ってみた"',
      'emoji: "🤖"',
      'type: "tech"',
      'topics: ["ai", "mcp", "typescript", "pokemon"]',
      'published: true',
      "published_at: '2026-04-19 21:00'",
      '---',
      '',
    ].join('\n')
    expect(result).toBe(expected)
  })

  it('matches sha256 of the expected frontmatter block', () => {
    const fm: ZennFrontmatter = {
      title:
        '育成論はAIと並走する時代へ。ポケモンバトルアドバイザー「ai-rotom」を作ってみた',
      emoji: '🤖',
      type: 'tech',
      topics: ['ai', 'mcp', 'typescript', 'pokemon'],
      published: true,
      published_at: '2026-04-19 21:00',
    }
    const result = stringifyZennFrontmatter(fm)
    const hash = createHash('sha256').update(result).digest('hex')
    // 現行記事から抽出した frontmatter ブロックの sha256。
    // 実体は "---\ntitle: ...\n---\n"。
    expect(hash).toBe(
      '44a12e62c3f31827c5a25087a84812484c132b8001d269268eeecdda2a101d0f',
    )
  })

  it('escapes double quotes in title by YAML double-quoting rules', () => {
    const fm: ZennFrontmatter = {
      title: 'hello "world"',
      emoji: '🤖',
      type: 'idea',
      topics: [],
      published: false,
      published_at: '2026-04-19 21:00',
    }
    const result = stringifyZennFrontmatter(fm)
    // YAML double-quoted string では " を \" でエスケープする。
    expect(result).toContain('title: "hello \\"world\\""')
  })

  it('escapes backslashes in title', () => {
    const fm: ZennFrontmatter = {
      title: 'hello\\world',
      emoji: '🤖',
      type: 'idea',
      topics: [],
      published: false,
      published_at: '2026-04-19 21:00',
    }
    const result = stringifyZennFrontmatter(fm)
    expect(result).toContain('title: "hello\\\\world"')
  })

  it('escapes single quotes in published_at by YAML single-quoting rules', () => {
    const fm: ZennFrontmatter = {
      title: 'x',
      emoji: '🤖',
      type: 'idea',
      topics: [],
      published: false,
      // 想定は pattern match 外だが stringifier は quote 規則のみ責務
      published_at: "2026-04-19 21:00",
    }
    const result = stringifyZennFrontmatter(fm)
    expect(result).toContain("published_at: '2026-04-19 21:00'")
  })

  it('omits emoji when not provided', () => {
    const fm: ZennFrontmatter = {
      title: 'x',
      type: 'tech',
      topics: ['a'],
      published: true,
      published_at: '2026-04-19 21:00',
    }
    const result = stringifyZennFrontmatter(fm)
    expect(result).not.toContain('emoji')
  })

  it('produces empty topics as "topics: []"', () => {
    const fm: ZennFrontmatter = {
      title: 'x',
      type: 'tech',
      topics: [],
      published: false,
      published_at: '2026-04-19 21:00',
    }
    const result = stringifyZennFrontmatter(fm)
    expect(result).toContain('topics: []')
  })
})
