/**
 * prerender 対象の記事ルートを決定する純関数。
 *
 * Nuxt の `nitro.prerender.routes` に渡す動的ルートを生成する目的で、
 * articles の列から静的ページ一覧を導出する。副作用を持たない純関数に
 * 切り出すことで、ビルド時挙動を単体テストで検証できるようにする。
 *
 * fail-closed 設計:
 *   本番ビルド (NODE_ENV === 'production') で preview フラグが立っている
 *   状態は「下書きが本番に漏れる」致命的事故に直結する。ここで明示的に
 *   throw して build を失敗させ、誤設定の本番デプロイを水際で止める。
 */

/** preview 状態を本番で検出した際に送出するエラーメッセージ */
export const PREVIEW_IN_PRODUCTION_ERROR_MESSAGE =
  'preview mode is not allowed in production build'

/** 記事ルートの URL プレフィックス (`/articles/<slug>`) */
const ARTICLE_ROUTE_PREFIX = '/articles/'

/** production ビルドを識別する NODE_ENV の値 */
const NODE_ENV_PRODUCTION = 'production'

/**
 * prerender 判定に必要な最小限の記事情報。
 *
 * `useArticles` 等の高レベル composable が返す型とは独立に、ビルド時の
 * 判定だけに必要なフィールドだけを受け入れる。
 */
export interface Article {
  readonly slug: string
  readonly published: boolean
  readonly published_at?: string
}

/**
 * `buildPrerenderRoutes` の挙動を制御するオプション。
 *
 * - `preview`: true なら下書き・予約投稿も prerender 対象に含める
 * - `nodeEnv`: 実行時の `process.env.NODE_ENV`。production 判定に利用
 */
export interface BuildPrerenderRoutesOpts {
  readonly preview: boolean
  readonly nodeEnv: string | undefined
}

/**
 * articles から prerender 対象の URL 配列を生成する。
 *
 * 仕様:
 *   1. `nodeEnv === 'production'` かつ `preview === true` の場合は例外送出
 *      (本番ビルドで preview を有効にするのは禁止)
 *   2. `preview === true` なら全 articles のルートを返す
 *   3. `preview === false` なら以下の条件を満たす記事のみ:
 *      - `published === true`
 *      - かつ `published_at` が未指定、または `Date.parse(published_at)` が
 *        `buildTime` 以下 (予約投稿で未来日時のものは除外)
 *   4. `Date.parse` が NaN を返す不正な日時文字列は除外 (published_at は
 *      schema レイヤで検証しているが、純関数として堅牢にふるまう)
 *
 * @param articles 評価対象の記事リスト (readonly)
 * @param buildTime ビルド実行時刻。予約投稿判定の基準に利用
 * @param opts 挙動制御オプション
 * @returns prerender すべき URL の配列 (常に `/articles/<slug>` 形式)
 * @throws {Error} production ビルドで preview フラグが立っている場合
 */
export function buildPrerenderRoutes(
  articles: readonly Article[],
  buildTime: Date,
  opts: BuildPrerenderRoutesOpts,
): string[] {
  if (opts.nodeEnv === NODE_ENV_PRODUCTION && opts.preview === true) {
    throw new Error(PREVIEW_IN_PRODUCTION_ERROR_MESSAGE)
  }

  const buildTimeMs = buildTime.getTime()

  const filtered = opts.preview
    ? articles
    : articles.filter((article) => isVisibleAtBuildTime(article, buildTimeMs))

  return filtered.map((article) => `${ARTICLE_ROUTE_PREFIX}${article.slug}`)
}

/**
 * 記事がビルド時点で公開対象かを判定する。
 *
 * - `published === false` の下書きは常に false
 * - `published_at` 未指定は「公開扱い・予約なし」とみなす
 * - `published_at` が valid な日時で `buildTime` 以下なら true
 * - `Date.parse` が NaN (不正な文字列) なら false
 */
function isVisibleAtBuildTime(article: Article, buildTimeMs: number): boolean {
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
