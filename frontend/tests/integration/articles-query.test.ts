import { describe, expect, it, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { DRAFT_MARKER } from '../../constants/content-security'
import { INDEX_LATEST_ARTICLES_LIMIT } from '../../constants/article'
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
 *   1. 公開記事 (welcome / roadmap / changelog) の HTML が prerender される
 *   2. 下書き (draft-feature) / 予約投稿 (scheduled-release) の HTML は
 *      prerender されない
 *   3. 下書きマーカー `__DRAFT_MARKER__` が公開成果物に漏れていない
 *   4. Nuxt Content の SQLite DB には 5 件すべて登録されている
 *      (preview モードでは全件、production では可視判定でフィルタされる設計)
 *   5. composable 相当の並び順 / フィルタロジックが、
 *      実 DB 行に対しても期待通りに動作する
 *
 * preview モードを含む挙動は純関数 (`isArticleVisibleNow`) の unit test で
 * カバー済みのため、ここでは production 側の統合確認 + preview モードで
 * 期待される件数 (5 件) が DB 上揃うことの確認に留める。E2E での UI 挙動は
 * 将来の Playwright スイートに委ねる。
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FRONTEND_ROOT = resolve(__dirname, '../..')
const OUTPUT_PUBLIC = resolve(FRONTEND_ROOT, '.output/public')
const CONTENT_SQLITE = resolve(FRONTEND_ROOT, '.data/content/contents.sqlite')

/** production 公開される fixture 記事 (期待されるディレクトリ名) */
const PUBLIC_SLUGS = ['welcome', 'roadmap', 'changelog'] as const
/** production で除外される fixture 記事 */
const HIDDEN_SLUGS = ['draft-feature', 'scheduled-release'] as const

/** 予約投稿がまだ未来であることを前提としたビルド基準時刻 */
const BUILD_TIME_MS = Date.parse('2026-04-17T00:00:00Z')

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
  for (const dir of ['.output', '.data', '.nuxt']) {
    const full = resolve(FRONTEND_ROOT, dir)
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true })
    }
  }
  const result = spawnSync('npm', ['run', 'generate'], {
    cwd: FRONTEND_ROOT,
    stdio: 'inherit',
    // Node 20 系の ESM 解決に揃える
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

    it.each(HIDDEN_SLUGS)(
      '/articles/%s/index.html is NOT prerendered',
      (slug) => {
        const htmlPath = resolve(OUTPUT_PUBLIC, 'articles', slug, 'index.html')
        expect(existsSync(htmlPath)).toBe(false)
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

    it('includes all five fixture articles (preview-equivalent)', () => {
      expect(rows).toHaveLength(5)
      const slugs = rows.map((r) => r.stem).sort()
      expect(slugs).toEqual(
        ['changelog', 'draft-feature', 'roadmap', 'scheduled-release', 'welcome'].sort(),
      )
    })

    it('production visibility filter yields exactly the public slugs', () => {
      // composable と同じロジックで DB 行を絞り込む。
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
      const welcome = rows.find((r) => r.stem === 'welcome')
      expect(welcome).toBeDefined()
      if (!welcome) return
      const article = toArticle({
        stem: welcome.stem,
        path: welcome.path,
        title: welcome.title,
        type: 'idea',
        topics: [],
        published: welcome.published === 1,
        published_at: welcome.published_at ?? undefined,
      })
      expect(article.slug).toBe('welcome')
      expect(article.path).toBe('/welcome')
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
      // 3 件の時系列降順。最新の changelog が先頭になる想定。
      expect(sorted).toEqual(['changelog', 'roadmap', 'welcome'])
    })
  })

  describe('index latest limit constant', () => {
    it('aligns with the number of published fixtures at MVP', () => {
      // INDEX_LATEST_ARTICLES_LIMIT = 3。Step 10〜13 で index ページから
      // これを上限として参照する予定。fixture 件数との整合を確認する。
      expect(PUBLIC_SLUGS.length).toBe(INDEX_LATEST_ARTICLES_LIMIT)
    })
  })
})
