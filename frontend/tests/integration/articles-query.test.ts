import { describe, expect, it, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { DRAFT_MARKER } from '../../constants/content-security'
import {
  isArticleVisibleNow,
  toArticle,
} from '../../utils/article/articleVisibility'

/**
 * articles クエリ (composable + Nuxt Content パイプライン) の integration test。
 *
 * `npm run generate` を 1 回走らせて成果物 (`.output/public` と `.data/content`)
 * を取得し、以下を統合観点で検証する:
 *
 *   1. 公開記事 (hello) の HTML が prerender される
 *   2. 下書きマーカー `__DRAFT_MARKER__` が公開成果物に漏れていない
 *   3. Nuxt Content の SQLite DB に記事が正しく登録される
 *   4. composable 相当の並び順 / フィルタロジックが、
 *      実 DB 行に対しても期待通りに動作する
 *
 * preview モードや下書き / 予約投稿のフィルタリング自体は純関数
 * (`isArticleVisibleNow`) の unit test で全パターンをカバー済み。
 * ここでは「公開 articles が存在する状態での production generate が
 * 期待通りに動くこと」を最低限確認する。
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FRONTEND_ROOT = resolve(__dirname, '../..')
const OUTPUT_PUBLIC = resolve(FRONTEND_ROOT, '.output/public')
const CONTENT_SQLITE = resolve(FRONTEND_ROOT, '.data/content/contents.sqlite')

/**
 * production で公開される記事 slug 一覧。
 *
 * 現状は `site-articles/hello.md`（本サイト限定、Zenn Connect 対象外）のみ。
 * 本 integration test は「articles/ が空でも site-articles/ のみで
 * 本サイトがビルドできる」構成を検証する役割も兼ねる。
 */
const PUBLIC_SLUGS = ['hello'] as const

/** ビルド基準時刻 (全 PUBLIC_SLUGS の published_at 以降なら任意で良い) */
const BUILD_TIME_MS = Date.parse('2026-04-19T00:00:00Z')

interface ArticleDbRow {
  stem: string
  path: string
  title: string
  published: 0 | 1
  published_at: string | null
}

beforeAll(() => {
  // 前回の artifact をクリアしてから generate を実行する。
  // Nuxt Content の SQLite は `.data/content/contents.sqlite` に書き出され、
  // prerender 成果物は `.output/public/` に生成される。
  // `.nuxt/` は tsconfig.json が extends で参照しているため、
  // vitest が実行中にディレクトリごと消すと config 解決が失敗する。
  // nuxt generate が内部で prepare を走らせて再生成するので削除しない。
  for (const dir of ['.output', '.data']) {
    const full = resolve(FRONTEND_ROOT, dir)
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true })
    }
  }
  const result = spawnSync('npm', ['run', 'generate'], {
    cwd: FRONTEND_ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(
      `npm run generate failed with exit code ${result.status ?? 'null'}`,
    )
  }
}, 10 * 60 * 1000) // generate は最大 10 分許容

describe('articles query integration (production generate)', () => {
  describe('prerendered HTML output', () => {
    it.each(PUBLIC_SLUGS)(
      '/articles/%s/index.html is prerendered',
      (slug) => {
        const htmlPath = resolve(OUTPUT_PUBLIC, 'articles', slug, 'index.html')
        expect(existsSync(htmlPath)).toBe(true)
      },
    )
  })

  describe('draft marker must not leak into any public artifact', () => {
    it.each(PUBLIC_SLUGS)(
      '/articles/%s does not contain __DRAFT_MARKER__',
      (slug) => {
        const htmlPath = resolve(OUTPUT_PUBLIC, 'articles', slug, 'index.html')
        const html = readFileSync(htmlPath, 'utf8')
        expect(html).not.toContain(DRAFT_MARKER)
      },
    )
  })

  describe('Nuxt Content DB contents (used as composable input)', () => {
    let rows: ArticleDbRow[]

    beforeAll(() => {
      const db = new Database(CONTENT_SQLITE, { readonly: true })
      rows = db
        .prepare<[], ArticleDbRow>(
          'SELECT stem, path, title, published, published_at FROM _content_articles',
        )
        .all()
      db.close()
    })

    it('includes every published article', () => {
      expect(rows).toHaveLength(PUBLIC_SLUGS.length)
      const slugs = rows.map((r) => r.stem).sort()
      expect(slugs).toEqual([...PUBLIC_SLUGS].sort())
    })

    it('production visibility filter yields exactly the public slugs', () => {
      const visible = rows
        .filter((r) =>
          isArticleVisibleNow(
            {
              published: r.published === 1,
              published_at: r.published_at ?? undefined,
            },
            BUILD_TIME_MS,
          ),
        )
        .map((r) => r.stem)
        .sort()
      expect(visible).toEqual([...PUBLIC_SLUGS].sort())
    })

    it('toArticle maps DB rows to DTO shape used by composables', () => {
      const hello = rows.find((r) => r.stem === 'hello')
      expect(hello).toBeDefined()
      if (!hello) return
      const article = toArticle({
        stem: hello.stem,
        path: hello.path,
        title: hello.title,
        type: 'idea',
        topics: [],
        published: hello.published === 1,
        published_at: hello.published_at ?? undefined,
      })
      expect(article.slug).toBe('hello')
      expect(article.path).toBe('/hello')
      expect(article.published).toBe(true)
    })

    it('descending sort by published_at matches composable contract', () => {
      const sorted = rows
        .filter(
          (r) =>
            r.published === 1 && r.published_at && Date.parse(r.published_at) <= BUILD_TIME_MS,
        )
        .sort((a, b) => {
          const aMs = a.published_at ? Date.parse(a.published_at) : 0
          const bMs = b.published_at ? Date.parse(b.published_at) : 0
          return bMs - aMs
        })
        .map((r) => r.stem)
      expect(sorted).toEqual([...PUBLIC_SLUGS])
    })
  })
})
