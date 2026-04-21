import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * `scripts/verify-generated-frontmatter.js` の integration テスト。
 *
 * 本スクリプトは「generator が書き込んだ生成物 (articles/ と public/)
 * を独立 re-parse して、post-write で frontmatter が設計通りか検証する」
 * 二重防御の中核であるが、これまで単体テストが存在せず、契約違反
 * (`ignorePublish` が bool 化されたあとの文字列値揺れなど) を検知でき
 * なかった。P0-3 (code-reviewer) 指摘への対応。
 *
 * テスト戦略:
 *   - 実スクリプトを `spawnSync(node)` で子プロセス起動する。repo 汚染
 *     を避けるため `cwd` を `mkdtempSync` で作成した tmp ディレクトリに
 *     指定し、その配下に articles/ と public/ の fixture を配置する
 *   - スクリプトは `process.cwd()/articles` と `process.cwd()/public`
 *     を見に行く実装のため、cwd を切り替えるだけで fixture 経由での
 *     挙動確認ができる
 *   - 正常ケース = exit 0、違反ケース = exit 1 を契約として assert
 */

/**
 * 検証対象スクリプトの絶対パス。repo root からの相対パスで解決する。
 */
const SCRIPT_PATH = resolve(
  __dirname,
  '../../scripts/verify-generated-frontmatter.js',
)

/**
 * 1 ファイルの frontmatter + 本文を組み立てる簡易ヘルパ。
 * body は末尾改行つきで渡す想定。frontmatter は raw YAML 文字列とし、
 * 呼び出し側で必要に応じて違反を仕込めるようにする。
 */
function buildMarkdown(frontmatterYaml: string, body = '\nhello\n'): string {
  return `---\n${frontmatterYaml}---\n${body}`
}

/**
 * articles/ と public/ のサブディレクトリを備えた tmp workspace を生成し、
 * パスを返す。
 */
function prepareWorkspace(): string {
  const work = mkdtempSync(join(tmpdir(), 'verify-gen-fm-'))
  mkdirSync(join(work, 'articles'), { recursive: true })
  mkdirSync(join(work, 'public'), { recursive: true })
  return work
}

/**
 * `node scripts/verify-generated-frontmatter.js` を `cwd` 指定で実行する。
 */
function runScript(cwd: string): {
  status: number
  stdout: string
  stderr: string
} {
  const result = spawnSync('node', [SCRIPT_PATH], {
    cwd,
    encoding: 'utf8',
    // 本番と同じ fail-closed 挙動を観察するため、環境変数は極力継承する
    env: process.env,
  })
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

describe('verify-generated-frontmatter.js (integration)', () => {
  it('exits 0 when both articles/ and public/ outputs are valid', () => {
    const work = prepareWorkspace()
    writeFileSync(
      join(work, 'articles', 'ok.md'),
      buildMarkdown(
        [
          'title: ok',
          'type: tech',
          'topics: []',
          'published: true',
          "published_at: '2026-04-19 21:00'",
        ].join('\n') + '\n',
      ),
    )
    writeFileSync(
      join(work, 'public', 'ok.md'),
      buildMarkdown(
        [
          'title: ok',
          'tags: []',
          'private: false',
          'ignorePublish: false',
        ].join('\n') + '\n',
      ),
    )
    const result = runScript(work)
    expect(result.status).toBe(0)
  })

  it('exits 0 when public/*.md has ignorePublish: true (draft safety)', () => {
    // ignorePublish: true は「書き出しただけで publish しない下書き状態」を
    // 示す契約。verify は true/false いずれも受理する (bool 文字列であれば OK)。
    const work = prepareWorkspace()
    writeFileSync(
      join(work, 'public', 'draft.md'),
      buildMarkdown(
        [
          'title: draft',
          'tags: []',
          'private: true',
          'ignorePublish: true',
        ].join('\n') + '\n',
      ),
    )
    const result = runScript(work)
    expect(result.status).toBe(0)
  })

  it('exits 1 when public/*.md has ignorePublish as non-boolean string', () => {
    // M-1 の回帰検知: bool 以外 ("yes" や数値など) の値は fail-closed で
    // reject する必要がある。
    const work = prepareWorkspace()
    writeFileSync(
      join(work, 'public', 'bad-ignore.md'),
      buildMarkdown(
        [
          'title: bad',
          'tags: []',
          'private: false',
          'ignorePublish: yes',
        ].join('\n') + '\n',
      ),
    )
    const result = runScript(work)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('ignorePublish')
  })

  it('exits 1 when articles/*.md has published_at in an unaccepted format', () => {
    const work = prepareWorkspace()
    writeFileSync(
      join(work, 'articles', 'bad-date.md'),
      buildMarkdown(
        [
          'title: bad date',
          'type: tech',
          'topics: []',
          'published: true',
          "published_at: '2026/04/19 21:00'",
        ].join('\n') + '\n',
      ),
    )
    const result = runScript(work)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('published_at')
  })

  it('exits 1 when articles/*.md has published as a bare boolean (unquoted YAML bool)', () => {
    // FAILSAFE parse: bool は文字列として扱われ、検証側は "true"/"false"
    // 文字列のみを受理する。YAML で `published: true` のように書かれた場合、
    // FAILSAFE では bool 型ではなく string "true" として解釈される想定で
    // OK になる。一方、"True" や誤記の "published: 1" などは NG になる。
    const work = prepareWorkspace()
    writeFileSync(
      join(work, 'articles', 'bad-published.md'),
      buildMarkdown(
        [
          'title: bad',
          'type: tech',
          'topics: []',
          'published: 1',
          "published_at: '2026-04-19 21:00'",
        ].join('\n') + '\n',
      ),
    )
    const result = runScript(work)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('published')
  })

  it('exits 1 when frontmatter block is missing the closing delimiter', () => {
    const work = prepareWorkspace()
    // `---` で始まるが閉じていない異常ファイル。
    writeFileSync(
      join(work, 'articles', 'broken.md'),
      '---\ntitle: broken\ntype: tech\n',
    )
    const result = runScript(work)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('frontmatter')
  })
})
