/**
 * タグ index / タグページに関する定数。
 *
 * `tags.json` の書き出し先・公開パス・タグページの URL プレフィックスなど、
 * ビルド時 (`nuxt.config.ts`) と runtime (`useTagIndex` / タグページ) の
 * 双方から参照される値を単一ソースとしてここに集約する。
 *
 * マジックストリングを避ける目的で named constant 化しており、パス規則の
 * 変更時はこのファイルだけを書き換えれば全経路に反映される。
 */

/**
 * タグページ `/articles/tags/[tag]` の URL プレフィックス。
 *
 * - `buildTagsIndex` の結果から prerender ルートを組み立てる際
 * - 個別タグページ上で自身の URL を参照する際
 * の双方で利用する。
 */
export const ARTICLES_TAG_ROUTE_PREFIX = '/articles/tags/'

/**
 * runtime で `$fetch` するタグ index JSON の公開パス (先頭スラッシュ込み)。
 *
 * `useTagIndex` composable が `$fetch(TAGS_INDEX_PUBLIC_PATH)` で取得する。
 */
export const TAGS_INDEX_PUBLIC_PATH = '/tags.json'

/**
 * `tags.json` を書き出す public directory 上の相対パス (先頭スラッシュなし)。
 *
 * `nitro.options.output.publicDir` と `path.join` して絶対パスを得る。
 * `TAGS_INDEX_PUBLIC_PATH` と整合が取れるよう、leading slash の有無だけが
 * 差分になる形に揃えている。
 */
export const TAGS_INDEX_FILE_NAME = 'tags.json'
