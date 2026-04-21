import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listSourceArticles } from '../../../scripts/lib/io/listSourceArticles'

describe('listSourceArticles', () => {
  /**
   * site-articles を模した tmp dir に複数ファイルを置いてテストする。
   */
  function buildDir(files: ReadonlyArray<{ name: string; content?: string }>): string {
    const dir = mkdtempSync(join(tmpdir(), 'list-source-'))
    for (const { name, content } of files) {
      const target = join(dir, name)
      // nested dir が必要な場合に備える (現状は平坦)。
      writeFileSync(target, content ?? 'body')
    }
    return dir
  }

  it('returns only *.md files in deterministic (sorted) order', () => {
    const dir = buildDir([
      { name: 'b.md' },
      { name: 'a.md' },
      { name: 'c.md' },
      { name: 'ignore.txt' },
    ])
    const entries = listSourceArticles(dir)
    expect(entries).toEqual([
      join(dir, 'a.md'),
      join(dir, 'b.md'),
      join(dir, 'c.md'),
    ])
  })

  it('skips dotfiles and non-md files', () => {
    const dir = buildDir([
      { name: '.DS_Store' },
      { name: 'README.md' },
      { name: 'note.txt' },
    ])
    const entries = listSourceArticles(dir)
    expect(entries).toEqual([join(dir, 'README.md')])
  })

  it('throws when the target directory does not exist', () => {
    expect(() =>
      listSourceArticles(join(tmpdir(), 'this-dir-does-not-exist-xyz')),
    ).toThrow()
  })

  it('skips nested directories (top-level only)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'list-source-nested-'))
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'sub', 'nested.md'), 'body')
    writeFileSync(join(dir, 'root.md'), 'body')
    const entries = listSourceArticles(dir)
    expect(entries).toEqual([join(dir, 'root.md')])
  })
})
