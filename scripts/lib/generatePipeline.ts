import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import type { Root } from 'mdast'
import {
  ARTICLES_DIR_NAME,
  PUBLIC_DIR_NAME,
  SITE_ARTICLES_DIR_NAME,
} from './constants'
import type { Clock } from './clock'
import { isFuturePublish, systemClock } from './clock'
import { listSourceArticles } from './io/listSourceArticles'
import { readArticleFile } from './io/readArticleFile'
import { removeObsoleteFile } from './io/removeObsoleteFile'
import { writeArticleFile } from './io/writeArticleFile'
import { toZennFrontmatter } from './frontmatter/toZennFrontmatter'
import { stringifyZennFrontmatter } from './frontmatter/zennStringifier'
import {
  toQiitaFrontmatter,
  type QiitaMergeSource,
} from './frontmatter/toQiitaFrontmatter'
import { stringifyQiitaFrontmatter } from './frontmatter/qiitaStringifier'
import {
  applyZennToQiitaPipeline,
  type PipelineOptions,
} from './syntax/transforms'
import { detectSlugCollisions, type SlugEntry } from './slug'

/**
 * generator コアの純粋ロジック。
 *
 * - fs を使うのは `io/` 配下のユーティリティ経由のみ
 * - 時刻判定は Clock を引数で受けて純関数化
 * - commit SHA は resolve 済みの文字列を引数で受ける (I/O 層はエントリポイント
 *   `scripts/generate.ts` の責務)
 *
 * オーケストレーション:
 *   1. site-articles/*.md を列挙
 *   2. 各記事を readArticleFile → zod 検証
 *   3. published !== true はスキップ (articles / public 共に出さない)
 *   4. zenn: true の記事 → stringifyZennFrontmatter + 本文 (未加工) で
 *      articles/<zennSlug>.md に書き出す
 *   5. qiita: true の記事 → 本文に Zenn → Qiita pipeline を適用し、
 *      stringifyQiitaFrontmatter で public/<qiitaSlug>.md に書き出す
 *      (未来日なら書き出さず既存を削除)
 *   6. public/.allowlist マニフェストを書き出す (assert-public-allowlist.sh
 *      が参照)
 *   7. slug 衝突検出
 */

/**
 * runGenerator の引数。
 */
export interface GeneratorOptions {
  /** リポジトリルートのパス (CI/本番では `process.cwd()`、テストでは tmp) */
  readonly rootDir: string
  /** 画像 URL 生成に使う commit SHA (resolveCommitSha で解決済み) */
  readonly commitSha: string
  /** 時刻 (テスト時は fixedClock を注入) */
  readonly clock?: Clock
  /** fork CI 対応: 画像 URL 生成を skip するかどうか (true のときは素通し) */
  readonly skipImageUrlRewrite?: boolean
}

/**
 * runGenerator の結果サマリ。
 */
export interface GeneratorResult {
  /** Zenn 向けに書き出した articles/<slug>.md の相対パス配列 */
  readonly zennOutputs: readonly string[]
  /** Qiita 向けに書き出した public/<slug>.md の相対パス配列 */
  readonly qiitaOutputs: readonly string[]
  /** 未来日 or qiita:false で削除した public/<slug>.md のパス配列 */
  readonly removedQiitaOutputs: readonly string[]
  /** 下書き扱いで一切出力しなかった原典パスの配列 */
  readonly skippedDrafts: readonly string[]
}

/**
 * Qiita pipeline を適用して本文を書き換える純関数。
 *
 * `remark-parse → pipeline transforms → remark-stringify` の順に実行する。
 * `skipImageUrlRewrite` が true のときは transformImage が副作用として
 * 吐き出す URL 書き換えをスキップするため、image 変換だけ抜いた pipeline を
 * 適用する (fork CI 対策)。
 */
function applyQiitaPipeline(
  body: string,
  options: PipelineOptions,
): string {
  const transformPlugin = () => (tree: Root) => {
    applyZennToQiitaPipeline(tree, options)
  }
  const processed = unified()
    .use(remarkParse)
    .use(transformPlugin)
    .use(remarkStringify, {
      bullet: '-',
      fences: true,
      incrementListMarker: false,
      listItemIndent: 'one',
      emphasis: '_',
      strong: '*',
    })
    .processSync(body)
  return String(processed)
}

/**
 * 既存の public/<slug>.md から merge 対象 (id / organization_url_name 等) を
 * 読み込む純関数 I/O。
 */
function readExistingQiitaMerge(filePath: string): QiitaMergeSource {
  if (!existsSync(filePath)) {
    return {}
  }
  const raw = readFileSync(filePath, 'utf8')
  const parsed = matter(raw)
  const data = parsed.data as Record<string, unknown>
  const result: Record<string, unknown> = {}
  if (typeof data.id === 'string') {
    result.id = data.id
  }
  if (typeof data.organization_url_name === 'string') {
    result.organization_url_name = data.organization_url_name
  }
  if (typeof data.slide === 'boolean') {
    result.slide = data.slide
  }
  if (typeof data.updated_at === 'string') {
    result.updated_at = data.updated_at
  }
  return result as QiitaMergeSource
}

/**
 * public/.allowlist マニフェストを書き出す純関数 I/O。
 *
 * basename (qiitaSlug) を 1 行 1 件でソート済みの形で出力する。末尾改行無し
 * (空ファイル時は `""` をそのまま書く)。
 */
function writeQiitaAllowlist(
  publicDir: string,
  basenames: readonly string[],
): void {
  const sorted = [...basenames].sort()
  const content = sorted.length === 0 ? '' : sorted.join('\n') + '\n'
  // 出力先 public/ が未作成のケース (generator 初回実行時など) に備えて
  // mkdir -p する。冪等。
  mkdirSync(publicDir, { recursive: true })
  writeFileSync(join(publicDir, '.allowlist'), content)
}

/**
 * runGenerator のメイン (純ロジック部)。
 *
 * 副作用は io/ 層に閉じ、戻り値で結果サマリを返す。
 */
export function runGenerator(options: GeneratorOptions): GeneratorResult {
  const clock = options.clock ?? systemClock
  const siteDir = join(options.rootDir, SITE_ARTICLES_DIR_NAME)
  const articlesDir = join(options.rootDir, ARTICLES_DIR_NAME)
  const publicDir = join(options.rootDir, PUBLIC_DIR_NAME)

  const sources = listSourceArticles(siteDir)

  const zennOutputs: string[] = []
  const qiitaOutputs: string[] = []
  const removedQiitaOutputs: string[] = []
  const skippedDrafts: string[] = []
  const zennSlugEntries: SlugEntry[] = []
  const qiitaSlugEntries: SlugEntry[] = []
  const qiitaAllowlist: string[] = []

  for (const src of sources) {
    const { frontmatter, body } = readArticleFile(src)
    if (frontmatter.published !== true) {
      // 下書きは一切出力しない (Qiita も Zenn も)。
      skippedDrafts.push(src)
      // qiita 側に残骸があれば削除する。
      if (typeof frontmatter.qiitaSlug === 'string') {
        const qiitaPath = join(publicDir, `${frontmatter.qiitaSlug}.md`)
        if (existsSync(qiitaPath)) {
          removeObsoleteFile(qiitaPath)
          removedQiitaOutputs.push(qiitaPath)
        }
      }
      continue
    }

    // --- Zenn 側 -----------------------------------------------------------
    if (frontmatter.zenn === true && typeof frontmatter.zennSlug === 'string') {
      zennSlugEntries.push({ slug: frontmatter.zennSlug, source: src })
      const zennFm = toZennFrontmatter(frontmatter)
      // Zenn 向け出力は本文を **加工しない**。frontmatter だけを再直列化し、
      // body は gray-matter が parse した `parsed.content` をそのまま貼る。
      // body は先頭に `\n` が付く (frontmatter 末尾の --- の直後改行) ため、
      // stringifyZennFrontmatter の結果 `---\n` にそのまま連結するだけで
      // 既存ファイルと byte 一致になる。
      const composed = stringifyZennFrontmatter(zennFm) + body
      const outPath = join(articlesDir, `${frontmatter.zennSlug}.md`)
      // expected frontmatter: byte-parity と独立 parse で一致確認
      writeArticleFile(outPath, composed, {
        title: zennFm.title,
        type: zennFm.type,
        topics: zennFm.topics,
        published: zennFm.published ? 'true' : 'false',
        published_at: zennFm.published_at,
      })
      zennOutputs.push(outPath)
    }

    // --- Qiita 側 ----------------------------------------------------------
    if (frontmatter.qiita === true && typeof frontmatter.qiitaSlug === 'string') {
      qiitaSlugEntries.push({ slug: frontmatter.qiitaSlug, source: src })
      qiitaAllowlist.push(frontmatter.qiitaSlug)
      const qiitaPath = join(publicDir, `${frontmatter.qiitaSlug}.md`)
      if (isFuturePublish(frontmatter.published_at, clock)) {
        // 未来日は public に出さない (既存があれば削除)。
        if (existsSync(qiitaPath)) {
          removeObsoleteFile(qiitaPath)
          removedQiitaOutputs.push(qiitaPath)
        }
        continue
      }
      const merge = readExistingQiitaMerge(qiitaPath)
      const qiitaFm = toQiitaFrontmatter(frontmatter, merge)
      const transformedBody = options.skipImageUrlRewrite
        ? body
        : applyQiitaPipeline(body, {
            image: { commitSha: options.commitSha },
          })
      const composed = stringifyQiitaFrontmatter(qiitaFm) + '\n' + transformedBody
      writeArticleFile(qiitaPath, composed, {
        title: qiitaFm.title,
        tags: qiitaFm.tags,
        private: qiitaFm.private ? 'true' : 'false',
        ignorePublish: 'true',
      })
      qiitaOutputs.push(qiitaPath)
      continue
    }

    // qiita: false だが既存 public/<slug>.md がある (フラグを落とした) 場合は
    // 削除する。qiitaSlug が frontmatter に残っていれば、それをキーに探す。
    if (frontmatter.qiita === false && typeof frontmatter.qiitaSlug === 'string') {
      const qiitaPath = join(publicDir, `${frontmatter.qiitaSlug}.md`)
      if (existsSync(qiitaPath)) {
        removeObsoleteFile(qiitaPath)
        removedQiitaOutputs.push(qiitaPath)
      }
    }
  }

  // --- slug 衝突検出 ------------------------------------------------------
  detectSlugCollisions(zennSlugEntries)
  detectSlugCollisions(qiitaSlugEntries)

  // --- public allowlist manifest -----------------------------------------
  writeQiitaAllowlist(publicDir, qiitaAllowlist)

  // qiita:false の記事が "元は qiita:true だった" 痕跡として残した
  // public/<slug>.md を強制削除するフォールバック。上のループで拾えない
  // (= 原典から消えた slug) ケースは PR-B では対象外とし、allowlist 検査で
  // 別経路でカバーする。
  return {
    zennOutputs,
    qiitaOutputs,
    removedQiitaOutputs,
    skippedDrafts,
  }
}
