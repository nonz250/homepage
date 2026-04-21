import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stringifyZennFrontmatter } from '../../../scripts/lib/frontmatter/zennStringifier'
import type { ZennFrontmatter } from '../../../scripts/lib/frontmatter/toZennFrontmatter'

/**
 * Zenn 向け stringifier のテスト。
 *
 * 最重要: 既存 `articles/nonz250-ai-rotom.md` の frontmatter ブロックを
 * byte レベルで再現できること (byte-parity snapshot)。
 *
 * 現行ファイルから観測した仕様:
 *   - キー順: title → emoji → type → topics → published → published_at
 *   - title / emoji / type: ダブルクォート `"..."`
 *   - topics: **フロースタイル** `["ai", "mcp", "typescript", "pokemon"]`
 *     (カンマの後ろに半角空白 1 つ)
 *   - published: 裸の `true` / `false`
 *   - published_at: **シングルクォート** `'2026-04-19 21:00'`
 *   - frontmatter 末尾: `---\n`
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

  it('produces a whole-file byte-parity output when combined with body', () => {
    const fixtureSite = resolve(
      __dirname,
      '../../fixtures/site-articles/ai-rotom-tech.md',
    )
    const fixtureExpected = resolve(
      __dirname,
      '../../fixtures/articles/nonz250-ai-rotom.md.expected',
    )
    const raw = readFileSync(fixtureSite, 'utf8')
    const matter = require('gray-matter')
    const parsed = matter(raw)
    const fm: ZennFrontmatter = {
      title: parsed.data.title,
      emoji: parsed.data.emoji,
      type: parsed.data.type,
      topics: parsed.data.topics,
      published: parsed.data.published,
      published_at: parsed.data.published_at,
    }
    const composed = stringifyZennFrontmatter(fm) + parsed.content
    const expected = readFileSync(fixtureExpected, 'utf8')
    expect(composed).toBe(expected)
    const actualHash = createHash('sha256').update(composed).digest('hex')
    const expectedHash = createHash('sha256').update(expected).digest('hex')
    expect(actualHash).toBe(expectedHash)
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
