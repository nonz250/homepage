import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * `scripts/assert-no-drafts.sh` の slug 境界マッチ挙動の integration test。
 *
 * 背景:
 *   PR-D 申し送りで発見された既存バグの回帰防止。
 *   draft slug `foo` が publish 済み `/articles/foo-tech/` の前方と substring
 *   一致して偽陽性 abort を出していた。修正後は末尾境界文字を要求する
 *   正規表現マッチにより、別 slug は検出されないこと。
 *
 * 検証方法:
 *   - tmp ディレクトリに `output/` を作り、.html / .json を投入
 *   - 環境変数 `ASSERT_NO_DRAFTS_OUTPUT_DIR` と `ASSERT_NO_DRAFTS_SLUGS_OVERRIDE`
 *     でシェルスクリプトの入力を差し替える (production 挙動には影響しない)
 *   - bash で shell を直接 spawn し exit code と stderr を検証
 */

/**
 * リポジトリ root (このテストファイルから見た `../..`)。
 */
const REPO_ROOT = resolve(__dirname, '../..')
const SCRIPT_PATH = join(REPO_ROOT, 'scripts', 'assert-no-drafts.sh')

/**
 * 成功終了コード。shell と合わせる。
 */
const EXIT_OK = 0
/**
 * 漏洩検知時の終了コード。shell と合わせる。
 */
const EXIT_LEAKED = 1

/**
 * shell スクリプトを与えられた output ディレクトリと draft slug 群で実行し、
 * 結果 (status / stdout / stderr) を返す。
 */
function runScript(options: {
  outputDir: string
  draftSlugs: string[]
}): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('bash', [SCRIPT_PATH], {
    env: {
      ...process.env,
      ASSERT_NO_DRAFTS_OUTPUT_DIR: options.outputDir,
      ASSERT_NO_DRAFTS_SLUGS_OVERRIDE: options.draftSlugs.join('\n'),
    },
    encoding: 'utf8',
  })
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

describe('assert-no-drafts.sh slug boundary matching', () => {
  let workspace: string
  let outputDir: string

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'assert-no-drafts-'))
    outputDir = join(workspace, 'output')
    mkdirSync(outputDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true })
  })

  it('does NOT flag a publish slug whose prefix matches a draft slug', () => {
    // draft: foo, publish: foo-tech は prefix が衝突する典型ケース。
    const indexHtml = join(outputDir, 'index.html')
    writeFileSync(
      indexHtml,
      '<html><body><a href="/articles/foo-tech/">published</a></body></html>',
      'utf8',
    )
    const result = runScript({ outputDir, draftSlugs: ['foo'] })
    expect(result.stderr).not.toContain("draft slug 'foo'")
    expect(result.status).toBe(EXIT_OK)
  })

  it('flags the exact draft slug when referenced with a trailing slash', () => {
    const indexHtml = join(outputDir, 'index.html')
    writeFileSync(
      indexHtml,
      '<html><body><a href="/articles/foo/">draft</a></body></html>',
      'utf8',
    )
    const result = runScript({ outputDir, draftSlugs: ['foo'] })
    expect(result.status).toBe(EXIT_LEAKED)
    expect(result.stderr).toContain("draft slug 'foo'")
  })

  it('flags the exact draft slug when referenced inside a quoted attribute', () => {
    const indexHtml = join(outputDir, 'index.html')
    writeFileSync(
      indexHtml,
      '<html><body><a href="/articles/foo">draft</a></body></html>',
      'utf8',
    )
    const result = runScript({ outputDir, draftSlugs: ['foo'] })
    expect(result.status).toBe(EXIT_LEAKED)
    expect(result.stderr).toContain("draft slug 'foo'")
  })

  it('flags the exact draft slug when referenced with a .html extension', () => {
    const indexHtml = join(outputDir, 'index.html')
    writeFileSync(
      indexHtml,
      '<html><body><a href="/articles/foo.html">draft</a></body></html>',
      'utf8',
    )
    const result = runScript({ outputDir, draftSlugs: ['foo'] })
    expect(result.status).toBe(EXIT_LEAKED)
    expect(result.stderr).toContain("draft slug 'foo'")
  })

  it('does NOT flag when no draft slugs are given', () => {
    const indexHtml = join(outputDir, 'index.html')
    writeFileSync(
      indexHtml,
      '<html><body><a href="/articles/anything/">ok</a></body></html>',
      'utf8',
    )
    const result = runScript({ outputDir, draftSlugs: [] })
    expect(result.status).toBe(EXIT_OK)
  })

  it('flags the DRAFT_MARKER regardless of draft slugs', () => {
    const indexHtml = join(outputDir, 'index.html')
    writeFileSync(indexHtml, '<html>__DRAFT_MARKER__</html>', 'utf8')
    const result = runScript({ outputDir, draftSlugs: [] })
    expect(result.status).toBe(EXIT_LEAKED)
    expect(result.stderr).toContain('DRAFT_MARKER leaked')
  })

  it('does NOT flag a slug that only appears as a substring (no boundary)', () => {
    // 念押し: foo が /articles/foobar のように別 slug の先頭部分にしかいない場合。
    const indexHtml = join(outputDir, 'index.html')
    writeFileSync(
      indexHtml,
      '<html><body><a href="/articles/foobar">published</a></body></html>',
      'utf8',
    )
    const result = runScript({ outputDir, draftSlugs: ['foo'] })
    expect(result.status).toBe(EXIT_OK)
  })
})
