import type { ArticleFrontmatter } from '../schema/article'

/**
 * Qiita 向け `public/<slug>.md` の frontmatter が持つ型。
 *
 * qiita-cli (`@qiita/qiita-cli`) との互換性:
 *   - title:    原典 title をそのまま
 *   - tags:     原典 topics を tags に写す (string[])
 *   - private:  原典 published === true なら false、published === false なら
 *               true (= 限定共有 = 未公開)
 *   - ignorePublish: **常に true** を強制する (書き込み時の fail-closed 保護)
 *   - updated_at / id / organization_url_name / slide: 既存 public/<slug>.md
 *     が持っていれば merge (qiita-cli の sync が書き込んだ値を保持)
 */
export interface QiitaFrontmatter {
  readonly title: string
  readonly tags: readonly string[]
  readonly private: boolean
  readonly ignorePublish: true
  readonly updated_at?: string
  readonly id?: string
  readonly organization_url_name?: string
  readonly slide?: boolean
}

/**
 * 原典 ArticleFrontmatter + 既存 Qiita 記事 (merge 対象) から Qiita 向け
 * QiitaFrontmatter を生成する純関数。
 *
 * @param source 原典 frontmatter
 * @param existing 既存 public/<slug>.md から読み込んだ frontmatter
 *                 (id / organization_url_name などのラウンドトリップ値)
 */
export interface QiitaMergeSource {
  readonly id?: string
  readonly organization_url_name?: string
  readonly slide?: boolean
  readonly updated_at?: string
}

/**
 * Zenn 向けと同じく、原典から Qiita 向け QiitaFrontmatter を生成する純関数。
 */
export function toQiitaFrontmatter(
  source: ArticleFrontmatter,
  existing: QiitaMergeSource = {},
): QiitaFrontmatter {
  const base: QiitaFrontmatter = {
    title: source.title,
    tags: source.topics,
    private: !source.published,
    ignorePublish: true,
  }
  // 既存の id 等は optional フィールドとしてマージする。undefined は除外する
  // ため条件付きでスプレッドする。
  const extras: Partial<QiitaFrontmatter> = {}
  if (existing.id !== undefined) {
    extras.id = existing.id
  }
  if (existing.organization_url_name !== undefined) {
    extras.organization_url_name = existing.organization_url_name
  }
  if (existing.slide !== undefined) {
    extras.slide = existing.slide
  }
  if (existing.updated_at !== undefined) {
    extras.updated_at = existing.updated_at
  }
  return { ...base, ...extras }
}
