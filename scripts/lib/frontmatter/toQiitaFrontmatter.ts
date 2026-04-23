import type { ArticleFrontmatter } from '../schema/article'
import { isFuturePublish, systemClock, type Clock } from '../clock'

/**
 * Qiita 向け `public/<slug>.md` の frontmatter が持つ型。
 *
 * qiita-cli v0.5.0 以降は `updated_at` / `id` / `organization_url_name` /
 * `slide` の 4 キーを **必須** でバリデートする (キー欠落で preview / publish
 * が弾かれる)。そのため本型では全て required にし、初回投稿時 (merge 元
 * 不在) でも空文字列 / false をデフォルトで書き出す。
 *
 * qiita-cli (`@qiita/qiita-cli`) との互換性:
 *   - title:    原典 title をそのまま
 *   - tags:     原典 topics を tags に写す (string[])
 *   - private:  原典 published === true なら false、published === false なら
 *               true (= 限定共有 = 未公開)
 *   - updated_at / id / organization_url_name: 既存 public/<slug>.md が
 *     持っていれば merge、なければ空文字列 ('')。qiita-cli の publish 後に
 *     id / updated_at が書き戻される。
 *   - slide: 既存があれば merge、なければ false。
 *   - ignorePublish: 二段防御の最終判定値。qiita:true かつ published:true かつ
 *                    published_at が **過去** のときのみ `false` (= publish 許可)。
 *                    それ以外は常に `true` (= 書き出し時 fail-closed で publish
 *                    をブロックする)。設計 D-6 に対応。
 */
export interface QiitaFrontmatter {
  readonly title: string
  readonly tags: readonly string[]
  readonly private: boolean
  readonly updated_at: string
  readonly id: string
  readonly organization_url_name: string
  readonly slide: boolean
  readonly ignorePublish: boolean
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
  // qiita-cli v0.5.0 以降は 4 キー (updated_at/id/organization_url_name/slide)
  // を必須バリデートする。merge 元が無い初回投稿では空文字列と false で
  // 埋めて、qiita-cli の型検査を通過させる。publish 後は qiita-cli が
  // id / updated_at を書き戻し、次回 generate のときに readExistingQiitaMerge
  // 経由で保持される。
  return {
    title: source.title,
    tags: source.topics,
    private: !source.published,
    updated_at: existing.updated_at ?? '',
    id: existing.id ?? '',
    organization_url_name: existing.organization_url_name ?? '',
    slide: existing.slide ?? false,
    ignorePublish: resolveIgnorePublish(source, clock),
  }
}
