import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectSlugEntriesFromDirs } from '../../../utils/prerender/collectSlugEntriesFromDirs'

/**
 * `collectSlugEntriesFromDirs` の単体テスト。
 *
 * I/O を伴うヘルパなので、OS の一時ディレクトリに fixture を作成して走査結果を
 * 検証する。副作用は afterEach で確実に掃除する。
 *
 * 検証観点:
 *   - 空入力 → 空配列
 *   - 存在しないディレクトリはスキップ (例外にしない)
 *   - 複数ディレクトリから `.md` のみを拾い、拡張子なしの slug を返す
 *   - サブディレクトリは辿らない (ネストされた `.md` は除外)
 */
describe('collectSlugEntriesFromDirs', () => {
  let tmpRoot: string

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'collect-slug-entries-'))
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('returns an empty array for an empty directory list', () => {
    expect(collectSlugEntriesFromDirs([])).toEqual([])
  })

  it('returns an empty array when all directories do not exist', () => {
    const nonexistent = join(tmpRoot, 'does-not-exist')
    expect(collectSlugEntriesFromDirs([nonexistent])).toEqual([])
  })

  it('collects .md files from multiple directories as slug entries', () => {
    const dirA = join(tmpRoot, 'a')
    const dirB = join(tmpRoot, 'b')
    mkdirSync(dirA)
    mkdirSync(dirB)
    writeFileSync(join(dirA, 'hello.md'), '---\ntitle: hello\n---\n')
    writeFileSync(join(dirA, 'not-a-post.txt'), 'skip me')
    writeFileSync(join(dirB, 'about.md'), '---\ntitle: about\n---\n')

    const entries = collectSlugEntriesFromDirs([dirA, dirB])
    const slugs = entries.map((e) => e.slug).sort()
    expect(slugs).toEqual(['about', 'hello'])
    for (const entry of entries) {
      expect(entry.absPath).toMatch(/\.md$/)
    }
  })

  it('does not descend into subdirectories', () => {
    const dir = join(tmpRoot, 'only-top')
    const nested = join(dir, 'nested')
    mkdirSync(dir)
    mkdirSync(nested)
    writeFileSync(join(dir, 'top.md'), '---\ntitle: top\n---\n')
    writeFileSync(join(nested, 'deep.md'), '---\ntitle: deep\n---\n')

    const entries = collectSlugEntriesFromDirs([dir])
    expect(entries.map((e) => e.slug)).toEqual(['top'])
  })
})
