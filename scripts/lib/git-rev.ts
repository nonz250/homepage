import { execFileSync } from 'node:child_process'
import {
  CANONICAL_GITHUB_OWNER,
  CANONICAL_GITHUB_REPO,
} from './constants'

/**
 * git 由来の commit SHA および repository 判定を扱う薄い adapter。
 *
 * 設計:
 *   - 本番 (CI) では `CONTENT_COMMIT_SHA` env を必ず注入する運用にする
 *     (PR-E で GitHub Actions に設定)。
 *   - env が無い場合はローカル開発向けに `git rev-parse HEAD` にフォールバック。
 *   - fork CI では `GITHUB_REPOSITORY` が canonical と一致しないため、画像 URL
 *     生成を skip する判定フックを提供する (raw.githubusercontent を他人の
 *     リポジトリ向けに生成しないための措置)。
 *
 * I/O (child_process) はフォールバック 1 箇所に閉じ、テストでは純関数経路を
 * 検証できるよう env と fallback を引数注入可能にする。
 */

/**
 * resolveCommitSha に渡す依存注入コンテナ。
 *
 * - `env`: プロセス環境変数レコード。省略時は `process.env`。
 * - `fallback`: env 未設定時に呼ぶ関数。省略時は `git rev-parse HEAD` を実行。
 */
export interface ResolveCommitShaOptions {
  readonly env?: NodeJS.ProcessEnv
  readonly fallback?: () => string
}

/**
 * 本番 generator が使う commit SHA 解決のエントリポイント。
 *
 * 優先順位:
 *   1. env.CONTENT_COMMIT_SHA (trim 後が非空なら採用)
 *   2. fallback() (デフォルトは git rev-parse HEAD)
 *
 * どちらも空文字なら throw で fail-closed。
 */
export function resolveCommitSha(
  options: ResolveCommitShaOptions = {},
): string {
  const env = options.env ?? process.env
  const injected = (env.CONTENT_COMMIT_SHA ?? '').trim()
  if (injected.length > 0) {
    return injected
  }
  const fallback = options.fallback ?? defaultFallback
  const resolved = fallback().trim()
  if (resolved.length === 0) {
    throw new Error(
      '[resolveCommitSha] could not resolve commit SHA: neither CONTENT_COMMIT_SHA nor git fallback returned a value',
    )
  }
  return resolved
}

/**
 * デフォルトの fallback 実装: `git rev-parse HEAD` を同期実行する。
 *
 * child_process の単一呼び出しに閉じるため、shell 経由ではなく execFileSync を
 * 使って引数インジェクションの余地を断つ。
 */
function defaultFallback(): string {
  try {
    const stdout = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return stdout
  } catch (error) {
    throw new Error(
      `[resolveCommitSha] git rev-parse HEAD failed: ${(error as Error).message}`,
    )
  }
}

/**
 * isCanonicalRepository 用の依存注入コンテナ。
 */
export interface IsCanonicalRepositoryOptions {
  readonly env?: NodeJS.ProcessEnv
}

/**
 * 現在の実行環境が canonical リポジトリ (`nonz250/homepage`) かを判定する。
 *
 * - GitHub Actions では `GITHUB_REPOSITORY=owner/repo` が設定されるため、
 *   値が `CANONICAL_GITHUB_OWNER/CANONICAL_GITHUB_REPO` と一致するかで
 *   canonical / fork を見分ける。
 * - 未設定 (= ローカル開発や他の CI) の場合は canonical 扱い (true)。
 *   fork 対策はあくまで raw.githubusercontent URL を他人のリポジトリ向けに
 *   生成してしまう事故を防ぐためで、env が未設定なら通常パスを走らせる。
 */
export function isCanonicalRepository(
  options: IsCanonicalRepositoryOptions = {},
): boolean {
  const env = options.env ?? process.env
  const repository = env.GITHUB_REPOSITORY
  if (repository === undefined || repository.length === 0) {
    return true
  }
  return repository === `${CANONICAL_GITHUB_OWNER}/${CANONICAL_GITHUB_REPO}`
}
