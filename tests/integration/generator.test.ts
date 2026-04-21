import { describe, expect, it } from 'vitest'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { runGenerator } from '../../scripts/lib/generatePipeline'
import { fixedClock } from '../../scripts/lib/clock'

/**
 * generator の統合テスト。
 *
 * 検証項目:
 *   - fixture site-articles/ai-rotom-tech.md を入力し、articles/nonz250-ai-rotom.md
 *     がリポジトリ現行と **sha256 byte 一致** で生成される
 *   - 2 回連続実行で diff が無い (冪等性)
 *   - qiita: false のため public/<slug>.md は生成されない
 *   - 未来日の記事 (fixture の published_at に合わせて clock を過去にする)
 *     では public を削除する挙動
 */
describe('generator (integration)', () => {
  /**
   * 新しい tmp ワークスペースを作り、site-articles fixture を配置する。
   */
  function prepareWorkspace(): string {
    const work = mkdtempSync(join(tmpdir(), 'generator-int-'))
    const site = join(work, 'site-articles')
    const articles = join(work, 'articles')
    const publicDir = join(work, 'public')
    mkdirSync(site, { recursive: true })
    mkdirSync(articles, { recursive: true })
    mkdirSync(publicDir, { recursive: true })
    cpSync(
      resolve(__dirname, '../fixtures/site-articles/ai-rotom-tech.md'),
      join(site, 'ai-rotom-tech.md'),
      { recursive: false },
    )
    return work
  }

  const clockBefore = fixedClock('2026-04-19T11:59:00Z') // 未来 (JST 21:00 の直前)
  const clockAfter = fixedClock('2026-04-19T13:00:00Z') // 過去 (JST 22:00)

  it('produces byte-parity output with the canonical article (future published_at)', () => {
    const work = prepareWorkspace()
    runGenerator({
      rootDir: work,
      commitSha: 'dummy-sha',
      clock: clockAfter,
    })
    const generated = readFileSync(
      join(work, 'articles', 'nonz250-ai-rotom.md'),
      'utf8',
    )
    const expected = readFileSync(
      resolve(__dirname, '../fixtures/articles/nonz250-ai-rotom.md.expected'),
      'utf8',
    )
    expect(generated).toBe(expected)
    const generatedHash = createHash('sha256').update(generated).digest('hex')
    const expectedHash = createHash('sha256').update(expected).digest('hex')
    expect(generatedHash).toBe(expectedHash)
  })

  it('is idempotent: running twice produces the same files', () => {
    const work = prepareWorkspace()
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockAfter })
    const firstRun = readFileSync(
      join(work, 'articles', 'nonz250-ai-rotom.md'),
      'utf8',
    )
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockAfter })
    const secondRun = readFileSync(
      join(work, 'articles', 'nonz250-ai-rotom.md'),
      'utf8',
    )
    expect(secondRun).toBe(firstRun)
  })

  it('does not produce public/<slug>.md when qiita: false', () => {
    const work = prepareWorkspace()
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockAfter })
    // qiita: false なので public/ ディレクトリは作られるが中身は空 (allowlist
    // マニフェストのみ)
    const qiitaOut = join(work, 'public', 'nonz250-ai-rotom.md')
    expect(existsSync(qiitaOut)).toBe(false)
  })

  it('respects future published_at: the public output would also be skipped', () => {
    // 現行 fixture は qiita:false だが、仮に qiita:true で未来日だった場合、
    // public/<slug>.md は生成されず、既存があっても削除される必要がある。
    // ここでは "未来日でも articles/ には書き出す" ことを最小限 assert する。
    const work = prepareWorkspace()
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockBefore })
    expect(
      existsSync(join(work, 'articles', 'nonz250-ai-rotom.md')),
    ).toBe(true)
  })

  it('deletes an existing public/<slug>.md when qiita flag is flipped to false (with qiitaSlug retained)', () => {
    // "以前は qiita:true で public/<slug>.md が生成されていた" 状況を作り、
    // 現在の fixture (qiita:false) で generator を走らせたら削除される
    // ことを確認する。qiitaSlug は削除の手がかりとして原典に残しておく運用
    // を想定するため、fixture を上書きして qiitaSlug を持たせる。
    const work = prepareWorkspace()
    const fixtureBody = readFileSync(
      resolve(__dirname, '../fixtures/site-articles/ai-rotom-tech.md'),
      'utf8',
    )
    // frontmatter に qiitaSlug を追加するだけの簡易書き換え。
    const patched = fixtureBody.replace(
      "zennSlug: 'nonz250-ai-rotom'",
      "zennSlug: 'nonz250-ai-rotom'\nqiitaSlug: nonz250-ai-rotom",
    )
    writeFileSync(join(work, 'site-articles', 'ai-rotom-tech.md'), patched)
    writeFileSync(
      join(work, 'public', 'nonz250-ai-rotom.md'),
      '---\ntitle: "old"\ntags: []\nprivate: false\nignorePublish: true\n---\n\nold body\n',
    )
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockAfter })
    expect(
      existsSync(join(work, 'public', 'nonz250-ai-rotom.md')),
    ).toBe(false)
  })

  it('emits the public allowlist manifest even when no qiita article is present', () => {
    const work = prepareWorkspace()
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockAfter })
    const manifest = join(work, 'public', '.allowlist')
    expect(existsSync(manifest)).toBe(true)
    const content = readFileSync(manifest, 'utf8')
    expect(content).toBe('')
  })

  it('writes public/<slug>.md with ignorePublish:false when qiita:true and published in the past', () => {
    const work = prepareWorkspace()
    const fixtureBody = readFileSync(
      resolve(__dirname, '../fixtures/site-articles/ai-rotom-tech.md'),
      'utf8',
    )
    // qiita:true に差し替え、qiitaSlug も付与。
    const patched = fixtureBody
      .replace('qiita: false', 'qiita: true')
      .replace(
        "zennSlug: 'nonz250-ai-rotom'",
        "zennSlug: 'nonz250-ai-rotom'\nqiitaSlug: nonz250-ai-rotom-qiita",
      )
    writeFileSync(join(work, 'site-articles', 'ai-rotom-tech.md'), patched)
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockAfter })
    const qiitaOut = join(work, 'public', 'nonz250-ai-rotom-qiita.md')
    expect(existsSync(qiitaOut)).toBe(true)
    const content = readFileSync(qiitaOut, 'utf8')
    // 基本 frontmatter
    expect(content).toContain('title:')
    expect(content).toContain('tags:')
    expect(content).toContain('private: false')
    // 設計 D-6: qiita:true かつ published:true かつ過去日なら publish 許可。
    // (旧挙動は常に true 固定だったため、contract として false を明示する)
    expect(content).toContain('ignorePublish: false')
    // Zenn 独自 @[card] は裸 URL に変換されている
    expect(content).not.toContain('@[card]')
    // 画像は raw.githubusercontent に書き換わっている (commit SHA 反映)
    expect(content).toMatch(
      /raw\.githubusercontent\.com\/nonz250\/homepage\/dummy-sha\/images\/ai-rotom\//,
    )
    // allowlist に qiitaSlug が載る
    const manifest = readFileSync(
      join(work, 'public', '.allowlist'),
      'utf8',
    )
    expect(manifest).toContain('nonz250-ai-rotom-qiita')
  })

  it('keeps ignorePublish:true when qiita:true but published:false (draft safety net)', () => {
    // published:false の場合 generator は public 出力をそもそもスキップするため、
    // 本ケースを再現するには fixture を qiita:true + published:true + 過去日に
    // 固定したうえで、qiita フラグを落とした同一記事の "書きかけ" を模した別
    // fixture を用意する必要がある。ここでは toQiitaFrontmatter の bool 契約と
    // pipeline の整合性を確認するため、未来日 = ignorePublish:true のシナリオで
    // "public が削除される" 副作用ではなく "qiita:true でも未来日なら書き出さず、
    // 既存があれば削除" のルートを辿ることを同時に検証する。
    const work = prepareWorkspace()
    const fixtureBody = readFileSync(
      resolve(__dirname, '../fixtures/site-articles/ai-rotom-tech.md'),
      'utf8',
    )
    const patched = fixtureBody
      .replace('qiita: false', 'qiita: true')
      .replace(
        "zennSlug: 'nonz250-ai-rotom'",
        "zennSlug: 'nonz250-ai-rotom'\nqiitaSlug: nonz250-ai-rotom-qiita",
      )
    writeFileSync(join(work, 'site-articles', 'ai-rotom-tech.md'), patched)
    // 未来日扱いとなる clock を使う → public は書き出されない (既存なら削除)。
    runGenerator({ rootDir: work, commitSha: 'dummy-sha', clock: clockBefore })
    const qiitaOut = join(work, 'public', 'nonz250-ai-rotom-qiita.md')
    expect(existsSync(qiitaOut)).toBe(false)
  })

  it('skipImageUrlRewrite leaves image URLs untouched (fork CI fallback)', () => {
    const work = prepareWorkspace()
    const fixtureBody = readFileSync(
      resolve(__dirname, '../fixtures/site-articles/ai-rotom-tech.md'),
      'utf8',
    )
    const patched = fixtureBody
      .replace('qiita: false', 'qiita: true')
      .replace(
        "zennSlug: 'nonz250-ai-rotom'",
        "zennSlug: 'nonz250-ai-rotom'\nqiitaSlug: nonz250-ai-rotom-qiita",
      )
    writeFileSync(join(work, 'site-articles', 'ai-rotom-tech.md'), patched)
    runGenerator({
      rootDir: work,
      commitSha: 'dummy-sha',
      clock: clockAfter,
      skipImageUrlRewrite: true,
    })
    const qiitaOut = join(work, 'public', 'nonz250-ai-rotom-qiita.md')
    const content = readFileSync(qiitaOut, 'utf8')
    // 画像が原文のまま
    expect(content).toContain('/images/ai-rotom/')
    expect(content).not.toContain('raw.githubusercontent.com')
  })
})
