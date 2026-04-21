import type { ArticleFrontmatter } from '../schema/article'

/**
 * Zenn 向け `articles/<slug>.md` の frontmatter が持つ型。
 *
 * 現行 `articles/nonz250-ai-rotom.md` の実例に合わせて:
 *   - title (必須、ダブルクォート文字列)
 *   - emoji (任意、ダブルクォート文字列)
 *   - type  ('tech' | 'idea', ダブルクォート文字列)
 *   - topics (string[], フロースタイル `[...]`)
 *   - published (boolean、裸の true/false)
 *   - published_at (文字列、シングルクォート)
 *
 * 原典 (ArticleFrontmatter) からの差分:
 *   - site / zenn / qiita / zennSlug / qiitaSlug / qiitaPayload を削除
 *   - 値そのものは原典を byte で保持する (published_at 文字列の正規化禁止)
 */
export interface ZennFrontmatter {
  readonly title: string
  readonly emoji?: string
  readonly type: 'tech' | 'idea'
  readonly topics: readonly string[]
  readonly published: boolean
  readonly published_at: string
}

/**
 * 原典 ArticleFrontmatter から Zenn 向け ZennFrontmatter を生成する純関数。
 *
 * 配信フラグや slug などの原典専用フィールドを除去する責務のみ。文字列値の
 * 正規化 (大文字化・trim 等) は行わない (byte 一致方針)。
 */
export function toZennFrontmatter(
  source: ArticleFrontmatter,
): ZennFrontmatter {
  // ReadOnly な reshape に徹する。optional chain でガードし、emoji / topics
  // の省略時の挙動を明示する。
  const base: ZennFrontmatter = {
    title: source.title,
    type: source.type,
    topics: source.topics,
    published: source.published,
    published_at: source.published_at,
  }
  if (source.emoji !== undefined) {
    return { ...base, emoji: source.emoji }
  }
  return base
}
