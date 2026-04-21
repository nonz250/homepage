import { basename, extname } from 'node:path'

/**
 * slug 関連の純関数群。
 *
 * 設計方針:
 *   - 原典 basename は Zenn/Qiita の slug とは **必ずしも** 一致しない。
 *     frontmatter 側で `zennSlug` / `qiitaSlug` を明示する運用を基本とする。
 *   - ただし basename → slug の自動導出 (落とし穴検知用) は generator で利用
 *     するため、拡張子剥がしと衝突検出を純関数として提供する。
 */

/**
 * 原典 basename / slug で許容する拡張子 (Markdown)。
 *
 * site-articles/*.md 以外のファイルは I/O 層で除外されるが、deriveBasenameSlug
 * も防御的に拡張子を検査する。
 */
const SUPPORTED_ARTICLE_EXT = '.md'

/**
 * site-articles 配下のファイルパス (相対 / 絶対いずれも可) から、拡張子を
 * 除いた basename を返す。
 *
 * @throws 拡張子が `.md` 以外、または basename が空の場合。
 */
export function deriveBasenameSlug(filePath: string): string {
  const ext = extname(filePath)
  if (ext !== SUPPORTED_ARTICLE_EXT) {
    throw new Error(
      `[deriveBasenameSlug] expected ${SUPPORTED_ARTICLE_EXT} extension: ${JSON.stringify(filePath)}`,
    )
  }
  const base = basename(filePath, ext)
  if (base.length === 0) {
    throw new Error(
      `[deriveBasenameSlug] empty basename after stripping extension: ${JSON.stringify(filePath)}`,
    )
  }
  return base
}

/**
 * slug + source path のペア (衝突検知のエントリ)。
 */
export interface SlugEntry {
  readonly slug: string
  readonly source: string
}

/**
 * 与えられた SlugEntry 配列の中で、同一 slug が 2 回以上出現したら throw する。
 *
 * 運用性を重視し、エラーメッセージには衝突した slug と全 source path を
 * 列挙する。1 度に複数の衝突 slug が存在する場合は、全てをまとめて報告する。
 */
export function detectSlugCollisions(entries: readonly SlugEntry[]): void {
  const groups = new Map<string, string[]>()
  for (const entry of entries) {
    const existing = groups.get(entry.slug)
    if (existing === undefined) {
      groups.set(entry.slug, [entry.source])
    } else {
      existing.push(entry.source)
    }
  }
  const collisions: string[] = []
  for (const [slug, sources] of groups) {
    if (sources.length > 1) {
      collisions.push(`  - ${slug}: ${sources.join(', ')}`)
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `[detectSlugCollisions] slug collision detected:\n${collisions.join('\n')}`,
    )
  }
}
