/**
 * ビルド時に `.output/public/tags.json` として書き出されるタグ index を
 * runtime で取得する composable。
 *
 * Nuxt Content v3 の `queryCollection('articles').where('topics', 'like', ...)`
 * は内部的に JSON としてシリアライズされた配列に対する `LIKE` 検索のため
 * 境界が曖昧になる制約がある。それを避けるため、ビルド時に純関数
 * `buildTagsIndex` で組み立てた `Record<tag, slug[]>` を静的ファイルとして
 * 配信し、runtime では `$fetch('/tags.json')` で読み込む方針を採る
 * (設計 v4 + Batch C 申し送り)。
 *
 * fail-safe:
 *   - `tags.json` が存在しない (dev サーバで `nitro:build:public-assets` が
 *     呼ばれていない) 場合、`$fetch` は 404 になる
 *   - JSON parse 失敗 (typeof !== 'object') も想定
 *   - いずれも UI が 500 エラーを返すのではなく、空マップにフォールバック
 *     する。タグページ側で「該当タグなし → 404」は個別に判定する
 *
 * dev でフォールバックして空マップになるのは意図的挙動。preview mode や
 * generate 済み成果物を preview でサーブしている場合は tags.json が正しく
 * 配信されるため、タグページも期待通り動く。
 */
import { TAGS_INDEX_PUBLIC_PATH } from '~/constants/tags'

/** タグ index の型。`Record<tag, slug[]>` と等価。 */
export type TagIndexMap = Record<string, string[]>

/**
 * runtime でタグ index を取得する。
 *
 * - 取得成功 → パース済み `TagIndexMap` を返す
 * - 失敗 (404 / network error / 不正な型) → 空オブジェクト
 *
 * fetch の具体的なエラーを呼び出し側に伝える必要はないため、いかなる失敗も
 * 静かに空マップへ落とす。タグページ側はキーの有無で 404 を判定する。
 */
export async function useTagIndex(): Promise<TagIndexMap> {
  try {
    const raw = await $fetch<unknown>(TAGS_INDEX_PUBLIC_PATH)
    return normalizeTagIndex(raw)
  }
  catch {
    return {}
  }
}

/**
 * `$fetch` の戻り値を安全な `TagIndexMap` に正規化する純関数。
 *
 * JSON 型としては有効でも、想定外の shape (配列、null、primitive、
 * 値が文字列配列でない等) が混入した場合も、異常系の UI クラッシュを
 * 避けるため該当 key を除外する fail-safe 方針を取る。
 */
function normalizeTagIndex(value: unknown): TagIndexMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const result: TagIndexMap = {}
  for (const [tag, slugs] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(slugs)) continue
    const stringSlugs = slugs.filter((s): s is string => typeof s === 'string')
    if (stringSlugs.length === 0) continue
    result[tag] = stringSlugs
  }
  return result
}
