#!/usr/bin/env node
/**
 * `scripts/generate.ts` — 記事コンテンツパイプライン v4 の CLI エントリポイント。
 *
 * 役割:
 *   - CI / ローカルから `npm run generate` で呼び出される
 *   - commit SHA の解決 (env / git fallback) のみ担当し、純ロジックは
 *     `scripts/lib/generatePipeline.ts` に委譲する
 *   - fork CI (GITHUB_REPOSITORY が canonical と異なる) では画像 URL 書き換えを
 *     skip する (raw.githubusercontent が他リポジトリ向けにならないよう保護)
 *
 * 実行:
 *   tsx scripts/generate.ts
 *   CONTENT_COMMIT_SHA=xxx tsx scripts/generate.ts
 */

import { runGenerator } from './lib/generatePipeline'
import {
  isCanonicalRepository,
  resolveCommitSha,
} from './lib/git-rev'
import { systemClock } from './lib/clock'

/**
 * CLI 実行時のメイン処理。例外は stderr に出して exit 1 で止める。
 */
function main(): void {
  const rootDir = process.cwd()
  const commitSha = resolveCommitSha()
  const canonical = isCanonicalRepository()
  if (!canonical) {
    // fork CI では canonical と不一致なので、raw.githubusercontent への
    // 書き換えを skip する (他人のリポジトリ向けに永続 URL を生成しない)。
    console.warn(
      '[generate] GITHUB_REPOSITORY is not canonical; image URL rewrite will be skipped.',
    )
  }
  const result = runGenerator({
    rootDir,
    commitSha,
    clock: systemClock,
    skipImageUrlRewrite: !canonical,
  })
  console.log(
    `[generate] wrote ${result.zennOutputs.length} zenn + ${result.qiitaOutputs.length} qiita articles, ` +
      `removed ${result.removedQiitaOutputs.length} obsolete qiita outputs, ` +
      `skipped ${result.skippedDrafts.length} drafts.`,
  )
}

try {
  main()
} catch (error) {
  const message = (error as Error).stack ?? String(error)
  process.stderr.write(`[generate] failed:\n${message}\n`)
  process.exit(1)
}
