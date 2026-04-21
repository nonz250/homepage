import { describe, expect, it } from 'vitest'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { runGenerator } from '../../scripts/lib/generatePipeline'
import { fixedClock } from '../../scripts/lib/clock'
import { readArticleFile } from '../../scripts/lib/io/readArticleFile'

/**
 * 実リポジトリの `site-articles/` と `articles/` を入力にした byte-parity
 * 検証テスト。PR-C での「既存記事移行」が完了した時点で以下を保証する:
 *
 *   1. 本番 `site-articles/` (tech + essay の 2 ファイル) を generator に
 *      流しても、現行 `articles/nonz250-ai-rotom.md` と byte 一致する
 *      出力が得られること (Zenn 公開済み記事の content 保護)
 *   2. tech 編 / essay 編の両方が v4 schema を通ること (schema drift 検知)
 *   3. 冪等性: 同じ入力で 2 回 generator を走らせても出力 byte が不変
 *   4. `public/` には `.allowlist` 以外が生成されないこと (qiita: false)
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

/**
 * 指定パスの内容から sha256 hex digest を返す。
 */
function sha256OfFile(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

describe('real-articles generator integration', () => {
  it('regenerates the canonical articles/<slug>.md with byte parity from real site-articles/', () => {
    const work = prepareWorkspaceFromRealSiteArticles()
    runGenerator({
      rootDir: work,
      commitSha: 'dummy-sha',
      clock: CLOCK_AFTER,
    })
    const generatedPath = join(work, 'articles', ZENN_ARTICLE_BASENAME)
    const canonicalPath = join(REPO_ROOT, 'articles', ZENN_ARTICLE_BASENAME)
    expect(existsSync(generatedPath)).toBe(true)
    const generated = readFileSync(generatedPath, 'utf8')
    const canonical = readFileSync(canonicalPath, 'utf8')
    expect(generated).toBe(canonical)
    expect(sha256OfFile(generatedPath)).toBe(sha256OfFile(canonicalPath))
  })

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

  it('writes only an empty .allowlist under public/ when no article has qiita: true', () => {
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
    expect(manifest).toBe('')
  })
})
