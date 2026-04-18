import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadArticlesFromFs } from '../../../utils/prerender/loadArticlesFromFs'
import { buildTagsIndex } from '../../../utils/prerender/buildTagsIndex'
import { ARTICLES_TAG_ROUTE_PREFIX } from '../../../constants/tags'

/**
 * タグ index 構築パス全体の integration test。
 *
 * `loadArticlesFromFs` (FS I/O) と `buildTagsIndex` (純関数) を実ファイルで
 * 接続し、Nuxt build hook 相当の経路がエンドツーエンドで期待通り動くことを
 * 検証する。`nuxt generate` までは回さず、nitro hook でやっている 2 段階の
 * 合成 (fs → topic aggregation) を fixture で単体の integration として確認
 * するレイヤー。
 *
 * generate 全体のスモークは別途 e2e (`articles.spec.ts`) と Step 19 以降で
 * 追加する `/articles/tags/[tag]` ページの e2e テストでカバーする。
 */
describe('tags index build pipeline (integration)', () => {
  let tmpRoot: string
  let zennDir: string
  let siteDir: string

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'tags-index-'))
    zennDir = join(tmpRoot, 'articles')
    siteDir = join(tmpRoot, 'site-articles')
    mkdirSync(zennDir)
    mkdirSync(siteDir)
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function writeArticle(dir: string, name: string, body: string): void {
    writeFileSync(join(dir, name), body)
  }

  it('aggregates topics across articles/ and site-articles/', () => {
    writeArticle(
      zennDir,
      'welcome.md',
      [
        '---',
        'title: welcome',
        'published: true',
        "published_at: '2026-04-01T00:00:00+09:00'",
        'topics:',
        '  - blog',
        '  - announcement',
        '---',
        '',
        'body',
      ].join('\n'),
    )
    writeArticle(
      siteDir,
      'hello.md',
      [
        '---',
        'title: hello',
        'published: true',
        "published_at: '2026-04-05T00:00:00+09:00'",
        'topics:',
        '  - blog',
        '---',
        '',
        'body',
      ].join('\n'),
    )

    const articles = loadArticlesFromFs([zennDir, siteDir])
    const index = buildTagsIndex(articles, new Date('2026-04-17T00:00:00Z'), {
      preview: false,
      nodeEnv: 'production',
    })
    const sortedBlog = [...(index.blog ?? [])].sort()
    expect(sortedBlog).toEqual(['hello', 'welcome'])
    expect(index.announcement).toEqual(['welcome'])
  })

  it('excludes drafts and scheduled articles in production mode', () => {
    writeArticle(
      zennDir,
      'published.md',
      [
        '---',
        'title: published',
        'published: true',
        'topics:',
        '  - ok',
        '---',
      ].join('\n'),
    )
    writeArticle(
      zennDir,
      'draft.md',
      [
        '---',
        'title: draft',
        'published: false',
        'topics:',
        '  - hidden',
        '---',
      ].join('\n'),
    )
    writeArticle(
      zennDir,
      'future.md',
      [
        '---',
        'title: future',
        'published: true',
        "published_at: '2099-01-01T00:00:00+09:00'",
        'topics:',
        '  - future',
        '---',
      ].join('\n'),
    )

    const articles = loadArticlesFromFs(zennDir)
    const index = buildTagsIndex(articles, new Date('2026-04-17T00:00:00Z'), {
      preview: false,
      nodeEnv: 'production',
    })
    expect(index).toHaveProperty('ok')
    expect(index).not.toHaveProperty('hidden')
    expect(index).not.toHaveProperty('future')
  })

  it('includes drafts and scheduled articles in preview mode', () => {
    writeArticle(
      zennDir,
      'draft.md',
      [
        '---',
        'title: draft',
        'published: false',
        'topics:',
        '  - hidden',
        '---',
      ].join('\n'),
    )
    writeArticle(
      zennDir,
      'future.md',
      [
        '---',
        'title: future',
        'published: true',
        "published_at: '2099-01-01T00:00:00+09:00'",
        'topics:',
        '  - future',
        '---',
      ].join('\n'),
    )

    const articles = loadArticlesFromFs(zennDir)
    const index = buildTagsIndex(articles, new Date('2026-04-17T00:00:00Z'), {
      preview: true,
      nodeEnv: 'development',
    })
    expect(index.hidden).toEqual(['draft'])
    expect(index.future).toEqual(['future'])
  })

  it('derives tag routes that can be attached to nitro.prerender.routes', () => {
    writeArticle(
      zennDir,
      'a.md',
      ['---', 'title: a', 'published: true', 'topics:', '  - alpha', '---'].join(
        '\n',
      ),
    )
    writeArticle(
      zennDir,
      'b.md',
      [
        '---',
        'title: b',
        'published: true',
        'topics:',
        '  - alpha',
        '  - beta',
        '---',
      ].join('\n'),
    )

    const articles = loadArticlesFromFs(zennDir)
    const index = buildTagsIndex(articles, new Date('2026-04-17T00:00:00Z'), {
      preview: false,
      nodeEnv: 'production',
    })
    const routes = Object.keys(index).map(
      (tag) => `${ARTICLES_TAG_ROUTE_PREFIX}${tag}`,
    )
    expect(new Set(routes)).toEqual(
      new Set(['/articles/tags/alpha', '/articles/tags/beta']),
    )
  })

  it('produces JSON-serializable output with predictable shape', () => {
    writeArticle(
      zennDir,
      'a.md',
      [
        '---',
        'title: a',
        'published: true',
        'topics:',
        '  - alpha',
        '  - beta',
        '---',
      ].join('\n'),
    )

    const articles = loadArticlesFromFs(zennDir)
    const index = buildTagsIndex(articles, new Date('2026-04-17T00:00:00Z'), {
      preview: false,
      nodeEnv: 'production',
    })
    const roundTripped = JSON.parse(JSON.stringify(index))
    expect(roundTripped).toEqual({ alpha: ['a'], beta: ['a'] })
  })
})
