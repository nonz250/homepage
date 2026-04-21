import { describe, expect, it } from 'vitest'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runGenerator } from '../../scripts/lib/generatePipeline'
import { fixedClock } from '../../scripts/lib/clock'
import { readArticleFile } from '../../scripts/lib/io/readArticleFile'

/**
 * 実リポジトリの `site-articles/` を入力にした generator の動的整合性テスト。
 *
 * 本 suite では以下の回帰防止に限定する:
 *   1. 現行 `site-articles/*.md` すべてが v4 schema を throw なしで通す
 *      (schema drift 検知)
 *   2. generator の **冪等性**: 同じ入力・同じ clock で 2 回実行しても
 *      articles/ 成果物の byte が変わらないこと
 *   3. `published: false` の下書き (essay 編) は articles/ に出力されない
 *   4. `qiita: true` の記事がない間は `public/` に `.allowlist` 以外が
 *      生成されない
 *
 * 記事本文・frontmatter の sha256 pin は敢えて設けない。記事は動的コンテンツ
 * であり、本文や `published_at` の更新は通常運用として許容される。
 * stringifier の出力形式回帰は `tests/unit/frontmatter/zennStringifier.test.ts`
 * で合成 fixture を使ってカバー済み。既公開記事の誤爆編集は CODEOWNERS +
 * branch protection の運用で担保する。
 *
 * 実リポジトリを汚さないため、入力ファイルは `mkdtempSync` で作った
 * tmp ワークスペースへ `cpSync` でコピーし、generator の出力先も tmp
 * 配下に限定する。
 */

/**
 * repository root へのパス (このテストファイルから見た `../..`)。
 */
const REPO_ROOT = resolve(__dirname, '../..')

/**
 * 公開時刻 (JST 2026-04-19 21:00) 以降に固定した Clock。isFuturePublish が
 * false を返し、public 出力の削除判定が過去日扱いになる。
 *
 * JST 21:00 = UTC 12:00 ちょうど。念のため +1 分の余裕を取る。
 */
const CLOCK_AFTER = fixedClock('2026-04-19T12:01:00Z')

/**
 * tech 編の原典ファイル名 (本番 `site-articles/` 直下の固定名)。
 */
const SITE_TECH_FILENAME = '2026-04-19-ai-rotom-tech.md'

/**
 * essay 編の原典ファイル名 (本番 `site-articles/` 直下の固定名)。
 */
const SITE_ESSAY_FILENAME = '2026-04-19-ai-rotom.md'

/**
 * Zenn 公開済み成果物の basename。
 */
const ZENN_ARTICLE_BASENAME = 'nonz250-ai-rotom.md'

/**
 * 実リポジトリの `site-articles/` 全ファイルを tmp ディレクトリへ複製した
 * 上で、output 用の articles/ および public/ を空で用意したワークスペース
 * を返す。
 */
function prepareWorkspaceFromRealSiteArticles(): string {
  const work = mkdtempSync(join(tmpdir(), 'real-articles-int-'))
  const site = join(work, 'site-articles')
  const articles = join(work, 'articles')
  const publicDir = join(work, 'public')
  mkdirSync(site, { recursive: true })
  mkdirSync(articles, { recursive: true })
  mkdirSync(publicDir, { recursive: true })
  cpSync(join(REPO_ROOT, 'site-articles'), site, { recursive: true })
  return work
}

describe('real-articles generator integration', () => {
  it('parses every real site-articles/*.md against the v4 schema without error', () => {
    const siteDir = join(REPO_ROOT, 'site-articles')
    const files = readdirSync(siteDir).filter(
      (name) => name.endsWith('.md') && !name.startsWith('.'),
    )
    // tech + essay の 2 ファイルを最低限期待する (regression guard)。
    expect(files).toContain(SITE_TECH_FILENAME)
    expect(files).toContain(SITE_ESSAY_FILENAME)
    for (const file of files) {
      const full = join(siteDir, file)
      expect(() => readArticleFile(full)).not.toThrow()
    }
  })

  it('is idempotent: running the generator twice does not change outputs', () => {
    const work = prepareWorkspaceFromRealSiteArticles()
    runGenerator({
      rootDir: work,
      commitSha: 'dummy-sha',
      clock: CLOCK_AFTER,
    })
    const firstRun = readFileSync(
      join(work, 'articles', ZENN_ARTICLE_BASENAME),
      'utf8',
    )
    runGenerator({
      rootDir: work,
      commitSha: 'dummy-sha',
      clock: CLOCK_AFTER,
    })
    const secondRun = readFileSync(
      join(work, 'articles', ZENN_ARTICLE_BASENAME),
      'utf8',
    )
    expect(secondRun).toBe(firstRun)
  })

  it('skips drafts (essay) so that no article file is produced for published: false', () => {
    const work = prepareWorkspaceFromRealSiteArticles()
    runGenerator({
      rootDir: work,
      commitSha: 'dummy-sha',
      clock: CLOCK_AFTER,
    })
    const articlesDir = join(work, 'articles')
    const produced = readdirSync(articlesDir).filter((name) =>
      name.endsWith('.md'),
    )
    // 出力は tech 1 本のみ。essay は `published: false` で skip される。
    expect(produced).toEqual([ZENN_ARTICLE_BASENAME])
  })

  it('reflects qiita-enabled articles in public/.allowlist even when future-dated', () => {
    // tech 編は qiita:true だが published_at が未来日のため public/<slug>.md は
    // 生成されない。一方 allowlist には qiitaSlug が載る (security 層で
    // "将来 Qiita に出す予定の slug" を管理するため)。
    const work = prepareWorkspaceFromRealSiteArticles()
    runGenerator({
      rootDir: work,
      commitSha: 'dummy-sha',
      clock: CLOCK_AFTER,
    })
    const publicDir = join(work, 'public')
    const entries = readdirSync(publicDir)
    expect(entries).toEqual(['.allowlist'])
    const manifest = readFileSync(join(publicDir, '.allowlist'), 'utf8')
    expect(manifest).toContain('nonz250-ai-rotom')
  })
})
