import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  readArticleFile,
  YAML_BOMB_ERROR_PREFIX,
} from '../../../scripts/lib/io/readArticleFile'
import {
  YAML_FILE_SIZE_LIMIT_BYTES,
  YAML_LINE_LIMIT,
} from '../../../scripts/lib/constants'

/**
 * readArticleFile は fs 依存の I/O だが、tmp ディレクトリに fixture を生成して
 * 実 I/O で検証する。純関数に寄せる部分 (size / line チェック) を明示的に
 * 覆うテストを置く。
 */
describe('readArticleFile', () => {
  /**
   * tmp 配下に 1 ファイル書いてそのパスを返す。
   */
  function writeTempArticle(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'read-article-'))
    const filePath = join(dir, 'test-article.md')
    writeFileSync(filePath, content)
    return filePath
  }

  const validFrontmatter = [
    '---',
    'title: "A valid title"',
    'emoji: "🤖"',
    'type: "tech"',
    'topics: ["ai"]',
    'published: true',
    "published_at: '2026-04-19 21:00'",
    'site: true',
    'zenn: true',
    'qiita: false',
    "zennSlug: 'nonz250-ai-rotom'",
    '---',
    '',
    'body',
    '',
  ].join('\n')

  it('parses a well-formed article with schema validation', () => {
    const filePath = writeTempArticle(validFrontmatter)
    const result = readArticleFile(filePath)
    expect(result.frontmatter.title).toBe('A valid title')
    expect(result.frontmatter.type).toBe('tech')
    expect(result.frontmatter.published).toBe(true)
    expect(result.frontmatter.zennSlug).toBe('nonz250-ai-rotom')
    expect(result.body.trim()).toBe('body')
  })

  it('rejects an article whose total size exceeds YAML_FILE_SIZE_LIMIT_BYTES', () => {
    // YAML_FILE_SIZE_LIMIT_BYTES を 1 byte 超過する frontmatter を作る。
    const padding = 'x'.repeat(YAML_FILE_SIZE_LIMIT_BYTES + 1)
    const oversized = [
      '---',
      `title: "${padding}"`,
      'type: "tech"',
      'published: true',
      "published_at: '2026-04-19 21:00'",
      '---',
      '',
      'body',
      '',
    ].join('\n')
    const filePath = writeTempArticle(oversized)
    expect(() => readArticleFile(filePath)).toThrow(
      new RegExp(YAML_BOMB_ERROR_PREFIX),
    )
  })

  it('rejects an article whose line count exceeds YAML_LINE_LIMIT', () => {
    const lines: string[] = ['---']
    lines.push('title: "hi"')
    lines.push('type: "tech"')
    lines.push('published: true')
    lines.push("published_at: '2026-04-19 21:00'")
    lines.push('---')
    for (let i = 0; i <= YAML_LINE_LIMIT; i += 1) {
      lines.push('body line')
    }
    const oversized = lines.join('\n')
    const filePath = writeTempArticle(oversized)
    expect(() => readArticleFile(filePath)).toThrow(
      new RegExp(YAML_BOMB_ERROR_PREFIX),
    )
  })

  it('rejects an article with invalid frontmatter (schema failure)', () => {
    const invalid = [
      '---',
      'title: "hi"',
      // type 欠落
      'published: true',
      "published_at: '2026-04-19 21:00'",
      '---',
      '',
      'body',
      '',
    ].join('\n')
    const filePath = writeTempArticle(invalid)
    expect(() => readArticleFile(filePath)).toThrow()
  })
})
