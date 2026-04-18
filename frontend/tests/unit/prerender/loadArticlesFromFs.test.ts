import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadArticlesFromFs } from '../../../utils/prerender/loadArticlesFromFs'

/**
 * `loadArticlesFromFs` の単体テスト。
 *
 * 単一ディレクトリ入力 (後方互換) / 複数ディレクトリ入力 (site-articles
 * 統合) の両パスを検証する。fixture は OS の一時ディレクトリに作り、
 * afterEach で掃除する。
 */
describe('loadArticlesFromFs', () => {
  let tmpRoot: string

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'load-articles-'))
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function writeArticle(dir: string, name: string, body: string): void {
    writeFileSync(join(dir, name), body)
  }

  it('returns an empty array when the directory does not exist (single path)', () => {
    expect(loadArticlesFromFs(join(tmpRoot, 'missing'))).toEqual([])
  })

  it('returns an empty array when every directory in the array is missing', () => {
    expect(
      loadArticlesFromFs([
        join(tmpRoot, 'missing-a'),
        join(tmpRoot, 'missing-b'),
      ]),
    ).toEqual([])
  })

  it('parses frontmatter from a single directory', () => {
    const dir = join(tmpRoot, 'articles')
    mkdirSync(dir)
    writeArticle(
      dir,
      'hello.md',
      [
        '---',
        'title: hello',
        'published: true',
        "published_at: '2026-04-18T00:00:00+09:00'",
        'topics:',
        '  - blog',
        '  - announcement',
        '---',
        '',
        'body',
      ].join('\n'),
    )

    const articles = loadArticlesFromFs(dir)
    expect(articles).toEqual([
      {
        slug: 'hello',
        title: 'hello',
        published: true,
        published_at: '2026-04-18T00:00:00+09:00',
        topics: ['blog', 'announcement'],
      },
    ])
  })

  it('merges .md files from every provided directory', () => {
    const zennDir = join(tmpRoot, 'articles')
    const siteDir = join(tmpRoot, 'site-articles')
    mkdirSync(zennDir)
    mkdirSync(siteDir)
    writeArticle(
      zennDir,
      'hello.md',
      '---\ntitle: hello\npublished: true\n---\n',
    )
    writeArticle(
      siteDir,
      'about.md',
      '---\ntitle: about\npublished: true\n---\n',
    )

    const articles = loadArticlesFromFs([zennDir, siteDir])
    const slugs = articles.map((a) => a.slug).sort()
    expect(slugs).toEqual(['about', 'hello'])
  })

  it('skips non-existent directories but still reads existing ones', () => {
    const siteDir = join(tmpRoot, 'site-articles')
    mkdirSync(siteDir)
    writeArticle(
      siteDir,
      'about.md',
      '---\ntitle: about\npublished: true\n---\n',
    )

    const articles = loadArticlesFromFs([
      join(tmpRoot, 'does-not-exist'),
      siteDir,
    ])
    expect(articles.map((a) => a.slug)).toEqual(['about'])
  })

  it('normalizes invalid published/published_at to safe defaults', () => {
    const dir = join(tmpRoot, 'articles')
    mkdirSync(dir)
    writeArticle(
      dir,
      'weird.md',
      ['---', 'title: weird', 'published: maybe', 'published_at: 42', '---'].join(
        '\n',
      ),
    )

    expect(loadArticlesFromFs(dir)).toEqual([
      {
        slug: 'weird',
        title: 'weird',
        published: false,
        published_at: undefined,
        topics: [],
      },
    ])
  })

  it('normalizes non-array and non-string topics to safe defaults', () => {
    const dir = join(tmpRoot, 'articles')
    mkdirSync(dir)
    writeArticle(
      dir,
      'not-array-topics.md',
      ['---', 'title: weird', 'published: true', 'topics: notarray', '---'].join(
        '\n',
      ),
    )
    writeArticle(
      dir,
      'mixed-topics.md',
      [
        '---',
        'title: mixed',
        'published: true',
        'topics:',
        '  - good',
        '  - 42',
        '  - ok',
        '---',
      ].join('\n'),
    )

    const result = loadArticlesFromFs(dir)
    const byName = Object.fromEntries(
      result.map((r) => [r.slug, r.topics] as const),
    )
    expect(byName['not-array-topics']).toEqual([])
    expect(byName['mixed-topics']).toEqual(['good', 'ok'])
  })

  it('ignores non-markdown files', () => {
    const dir = join(tmpRoot, 'articles')
    mkdirSync(dir)
    writeArticle(dir, 'hello.md', '---\ntitle: hello\npublished: true\n---\n')
    writeArticle(dir, 'README.txt', 'skip me')

    expect(loadArticlesFromFs(dir).map((a) => a.slug)).toEqual(['hello'])
  })

  it('falls back to empty string when title is missing or non-string', () => {
    const dir = join(tmpRoot, 'articles')
    mkdirSync(dir)
    writeArticle(dir, 'no-title.md', '---\npublished: true\n---\n')
    writeArticle(
      dir,
      'numeric-title.md',
      '---\ntitle: 42\npublished: true\n---\n',
    )
    const byName = Object.fromEntries(
      loadArticlesFromFs(dir).map((a) => [a.slug, a.title] as const),
    )
    expect(byName['no-title']).toBe('')
    expect(byName['numeric-title']).toBe('')
  })
})
