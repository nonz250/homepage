import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeArticleFile } from '../../../scripts/lib/io/writeArticleFile'

describe('writeArticleFile', () => {
  function tempDir(): string {
    return mkdtempSync(join(tmpdir(), 'write-article-'))
  }

  const validContent = [
    '---',
    'title: "hello"',
    'published: true',
    '---',
    '',
    'body',
    '',
  ].join('\n')

  it('writes the file verbatim when expectedKeys match', () => {
    const dir = tempDir()
    const filePath = join(dir, 'out.md')
    writeArticleFile(filePath, validContent, {
      title: 'hello',
      published: 'true',
    })
    const written = readFileSync(filePath, 'utf8')
    expect(written).toBe(validContent)
  })

  it('throws before writing when the content has broken frontmatter', () => {
    const dir = tempDir()
    const filePath = join(dir, 'broken.md')
    // frontmatter 終端が無い
    const broken = '---\ntitle: "hello"\n\nbody\n'
    expect(() =>
      writeArticleFile(filePath, broken, { title: 'hello' }),
    ).toThrow()
  })

  it('throws when expectedKeys do not match the content', () => {
    const dir = tempDir()
    const filePath = join(dir, 'mismatch.md')
    expect(() =>
      writeArticleFile(filePath, validContent, {
        title: 'different',
        published: 'true',
      }),
    ).toThrow()
  })
})
