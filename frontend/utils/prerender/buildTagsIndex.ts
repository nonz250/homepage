/**
 * 記事コレクションから「タグ (topic) → slug 一覧」のマップを組み立てる
 * 純関数。
 *
 * `/articles/tags/[tag]` ページのデータソースとして `.output/public/tags.json`
 * を prerender 時に emit するため、この関数はビルド hook (`nitro:config` /
 * `nitro:build:public-assets`) から呼び出される。Nuxt Content v3 の
 * `queryCollection('articles').where('topics', 'like', '%tag%')` は内部的に
 * JSON にシリアライズされた配列に対する `LIKE` 検索となるため、文字列境界が
 * 曖昧になる制約がある。代わりにビルド時に JSON として書き出し、runtime では
 * `fetch('/tags.json')` でそのまま利用する方針を採る (設計 v4 + Batch C
 * 申し送り)。
 *
 * fail-closed 設計:
 *   `buildPrerenderRoutes` と同じく、production ビルドで preview=true が
 *   指定された場合は throw して build を失敗させる。tags.json に下書きの
 *   slug を含めると、タグページ経由で下書きが発見される事故に直結するため。
 *
 * 副作用なし:
 *   I/O やグローバル状態へのアクセスを持たない。呼び出し側から `articles`
 *   と `buildTime` を注入し、返り値は `Record<tag, slug[]>`。
 */
import { PREVIEW_IN_PRODUCTION_ERROR_MESSAGE } from './buildPrerenderRoutes'

/** production ビルドを識別する NODE_ENV の値 */
const NODE_ENV_PRODUCTION = 'production'

/**
 * タグ index 構築に必要な最小限の記事情報。
 *
 * `buildPrerenderRoutes` の `Article` 型とほぼ同じ責務だが、こちらは
 * `topics` フィールドが追加で必要なため、専用インターフェースを切り出す。
 */
export interface TagIndexArticle {
  readonly slug: string
  readonly topics: readonly string[]
  readonly published: boolean
  readonly published_at?: string
}

/**
 * `buildTagsIndex` の挙動を制御するオプション。
 *
 * - `preview`: true なら下書き・予約投稿も対象に含める
 * - `nodeEnv`: 実行時の `process.env.NODE_ENV`。production 判定に利用
 */
export interface BuildTagsIndexOpts {
  readonly preview: boolean
  readonly nodeEnv: string | undefined
}

/**
 * articles からタグ index を組み立てる。
 *
 * 仕様:
 *   1. `nodeEnv === 'production'` かつ `preview === true` の場合は例外送出
 *      (本番ビルドで preview を有効にするのは禁止 / fail-closed)
 *   2. `preview === true` なら全 articles を集計対象にする
 *   3. `preview === false` なら `buildPrerenderRoutes` と同じ可視性条件
 *      (published === true かつ published_at が未指定または buildTime 以下) を
 *      満たす記事のみを集計
 *   4. `Date.parse` が NaN を返す不正な日時文字列は除外
 *   5. 各記事の topics を展開し、同じ tag に属する slug を配列として集約
 *   6. 1 記事内で同じ tag が重複していても slug は 1 回だけ含める
 *   7. タグごとの slug 配列は出現順を維持 (記事列の順序 × topics の順序)
 *
 * @param articles 評価対象の記事リスト (readonly)
 * @param buildTime ビルド実行時刻。予約投稿判定の基準に利用
 * @param opts 挙動制御オプション
 * @returns `Record<tag, slug[]>` 形式のタグ index
 * @throws {Error} production ビルドで preview フラグが立っている場合
 */
export function buildTagsIndex(
  articles: readonly TagIndexArticle[],
  buildTime: Date,
  opts: BuildTagsIndexOpts,
): Record<string, string[]> {
  if (opts.nodeEnv === NODE_ENV_PRODUCTION && opts.preview === true) {
    throw new Error(PREVIEW_IN_PRODUCTION_ERROR_MESSAGE)
  }

  const buildTimeMs = buildTime.getTime()
  const visible = opts.preview
    ? articles
    : articles.filter((article) => isVisibleAtBuildTime(article, buildTimeMs))

  const index: Record<string, string[]> = {}
  for (const article of visible) {
    const seenForArticle = new Set<string>()
    for (const topic of article.topics) {
      if (seenForArticle.has(topic)) continue
      seenForArticle.add(topic)
      if (!(topic in index)) {
        index[topic] = []
      }
      index[topic].push(article.slug)
    }
  }
  return index
}

/**
 * 記事がビルド時点で公開対象かを判定する。
 *
 * `buildPrerenderRoutes` と完全に同じロジックを採用する (両者で判定が
 * 食い違うと「prerender はされるのにタグ index に載らない」 / 「タグ index
 * には載るのに個別ページが 404」等の歪みが生じるため)。
 *
 * - `published === false` の下書きは常に false
 * - `published_at` 未指定は「公開扱い・予約なし」とみなす
 * - `published_at` が valid な日時で `buildTime` 以下なら true
 * - `Date.parse` が NaN (不正な文字列) なら false (fail-closed)
 */
function isVisibleAtBuildTime(
  article: TagIndexArticle,
  buildTimeMs: number,
): boolean {
  if (!article.published) {
    return false
  }
  if (article.published_at === undefined) {
    return true
  }
  const publishedAtMs = Date.parse(article.published_at)
  if (Number.isNaN(publishedAtMs)) {
    return false
  }
  return publishedAtMs <= buildTimeMs
}
