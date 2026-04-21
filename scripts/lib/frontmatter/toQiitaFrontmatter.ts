import type { ArticleFrontmatter } from '../schema/article'
import { isFuturePublish, systemClock, type Clock } from '../clock'

/**
 * Qiita 向け `public/<slug>.md` の frontmatter が持つ型。
 *
 * qiita-cli (`@qiita/qiita-cli`) との互換性:
 *   - title:    原典 title をそのまま
 *   - tags:     原典 topics を tags に写す (string[])
 *   - private:  原典 published === true なら false、published === false なら
 *               true (= 限定共有 = 未公開)
 *   - ignorePublish: 二段防御の最終判定値。qiita:true かつ published:true かつ
 *                    published_at が **過去** のときのみ `false` (= publish 許可)。
 *                    それ以外は常に `true` (= 書き出し時 fail-closed で publish
 *                    をブロックする)。設計 D-6 に対応。
 *   - updated_at / id / organization_url_name / slide: 既存 public/<slug>.md
 *     が持っていれば merge (qiita-cli の sync が書き込んだ値を保持)
 */
export interface QiitaFrontmatter {
  readonly title: string
  readonly tags: readonly string[]
  readonly private: boolean
  readonly ignorePublish: boolean
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
 * `ignorePublish` の最終値を決定する純関数。
 *
 * 設計 D-6 の二段防御:
 *   1. すべての生成物に `ignorePublish: true` を**デフォルトで**付ける
 *   2. **かつ** 以下 3 条件を同時に満たす記事のみ `false` に上書きする:
 *        - `qiita === true`
 *        - `published === true`
 *        - `published_at` が **未来ではない** (= 過去または同時刻)
 *
 * いずれか 1 条件でも欠けると `true` にフォールバックする (fail-closed)。
 * `published_at` が受理外の書式で throw する場合は上位で fail させる
 * (`isFuturePublish` が throw する)。
 *
 * 時刻判定は `Clock` を引数で受け取って純関数化する (副作用を持たない)。
 */
function resolveIgnorePublish(
  source: ArticleFrontmatter,
  clock: Clock,
): boolean {
  if (source.qiita !== true) {
    return true
  }
  if (source.published !== true) {
    return true
  }
  if (isFuturePublish(source.published_at, clock)) {
    return true
  }
  return false
}

/**
 * Zenn 向けと同じく、原典から Qiita 向け QiitaFrontmatter を生成する純関数。
 *
 * @param source 原典 frontmatter
 * @param existing 既存 `public/<slug>.md` から merge する補助情報 (任意)
 * @param clock 未来日判定に使う時計 (テストでは fixedClock、本番では systemClock)
 */
export function toQiitaFrontmatter(
  source: ArticleFrontmatter,
  existing: QiitaMergeSource = {},
  clock: Clock = systemClock,
): QiitaFrontmatter {
  const base: QiitaFrontmatter = {
    title: source.title,
    tags: source.topics,
    private: !source.published,
    ignorePublish: resolveIgnorePublish(source, clock),
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
