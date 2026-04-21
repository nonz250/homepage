import { describe, expect, it } from 'vitest'
import matter from 'gray-matter'
import { stringifyQiitaFrontmatter } from '../../../scripts/lib/frontmatter/qiitaStringifier'
import type { QiitaFrontmatter } from '../../../scripts/lib/frontmatter/toQiitaFrontmatter'

/**
 * Qiita 向け stringifier のテスト。
 *
 * qiita-cli (`node_modules/@qiita/qiita-cli/dist/lib/file-system-repo.js`) の
 * `toSaveFormat` は gray-matter.stringify を使っており、キー順は:
 *   title → tags → private → updated_at → id → organization_url_name →
 *   slide → ignorePublish
 *
 * 本 stringifier は同じキー順・quote 形式を踏襲する。ただし byte-parity では
 * なく **qiita-cli との互換性** を担保することが目的 (qiita-cli が sync で
 * 読み戻しても問題なく解釈できる frontmatter を生成する)。
 *
 * 検証項目:
 *   - 固定キー順 (title → tags → ...)
 *   - tags は string[] として YAML block style で出力
 *   - ignorePublish: true を強制
 *   - gray-matter で読み直したとき、入力と意味的に等価
 */
describe('stringifyQiitaFrontmatter', () => {
  const baseValid: QiitaFrontmatter = {
    title: 'hello',
    tags: ['ai', 'mcp'],
    private: false,
    ignorePublish: true,
  }

  it('emits keys in the documented Qiita CLI order', () => {
    const result = stringifyQiitaFrontmatter(baseValid)
    const idxTitle = result.indexOf('title:')
    const idxTags = result.indexOf('tags:')
    const idxPrivate = result.indexOf('private:')
    const idxIgnorePublish = result.indexOf('ignorePublish:')
    expect(idxTitle).toBeGreaterThan(-1)
    expect(idxTags).toBeGreaterThan(idxTitle)
    expect(idxPrivate).toBeGreaterThan(idxTags)
    expect(idxIgnorePublish).toBeGreaterThan(idxPrivate)
  })

  it('wraps frontmatter with --- delimiters and trailing newline', () => {
    const result = stringifyQiitaFrontmatter(baseValid)
    expect(result.startsWith('---\n')).toBe(true)
    expect(result.endsWith('---\n')).toBe(true)
  })

  it('round-trips through gray-matter parsing with equivalent values', () => {
    const result = stringifyQiitaFrontmatter({
      ...baseValid,
      id: 'abc123',
      organization_url_name: 'my-org',
      updated_at: '2026-04-19T12:00:00+09:00',
    })
    const parsed = matter(result + '\nbody\n')
    expect(parsed.data.title).toBe('hello')
    expect(parsed.data.tags).toEqual(['ai', 'mcp'])
    expect(parsed.data.private).toBe(false)
    expect(parsed.data.ignorePublish).toBe(true)
    expect(parsed.data.id).toBe('abc123')
    expect(parsed.data.organization_url_name).toBe('my-org')
  })

  it('omits optional keys when they are not set', () => {
    const result = stringifyQiitaFrontmatter(baseValid)
    expect(result).not.toContain('id:')
    expect(result).not.toContain('organization_url_name:')
    expect(result).not.toContain('updated_at:')
    expect(result).not.toContain('slide:')
  })

  it('renders tags in YAML block style (one per line)', () => {
    const result = stringifyQiitaFrontmatter(baseValid)
    // block style の目印: "tags:\n  - ai\n  - mcp\n"
    expect(result).toMatch(/tags:\n\s+- ai\n\s+- mcp\n/)
  })

  it('emits "tags: []" when tags array is empty', () => {
    const result = stringifyQiitaFrontmatter({ ...baseValid, tags: [] })
    expect(result).toContain('tags: []')
  })

  it('accepts ignorePublish=false when the upstream pipeline decided to publish', () => {
    const result = stringifyQiitaFrontmatter({
      ...baseValid,
      ignorePublish: false,
    })
    expect(result).toContain('ignorePublish: false')
  })

  it('fails closed when ignorePublish is not a boolean (undefined, string, null)', () => {
    // @ts-expect-error 契約違反 (bool 以外) を渡した場合のランタイム fail-closed
    expect(() => stringifyQiitaFrontmatter({ ...baseValid, ignorePublish: undefined })).toThrow()
    expect(() =>
      stringifyQiitaFrontmatter({
        ...baseValid,
        // @ts-expect-error string 型は契約違反
        ignorePublish: 'true',
      }),
    ).toThrow()
    expect(() =>
      stringifyQiitaFrontmatter({
        ...baseValid,
        // @ts-expect-error null 型は契約違反
        ignorePublish: null,
      }),
    ).toThrow()
  })
})
