/**
 * RSS フィードに関する定数を集約するモジュール。
 *
 * `/feed.xml` のパス、`<channel>` で配信するサイトメタ情報など、
 * ビルド時 (`nuxt.config.ts` の prerender 設定) と runtime (Nitro server
 * handler) の双方から参照される値を単一ソースとして集約する。マジック
 * ストリングを避け、変更時の影響範囲を本ファイルに閉じ込める目的。
 *
 * サイトメタは `nuxt.config.ts` の `app.head` / `runtimeConfig.public.baseUrl`
 * とも整合する必要がある。両者を同じ値で揃える単一ソースとしてここに置く。
 */

/**
 * RSS フィード JSON/XML の公開パス (先頭スラッシュ込み)。
 *
 * - `nitro.prerender.routes` でビルド時に emit するルート
 * - Nitro server handler (`server/routes/feed.xml.get.ts`) のマッピング
 * - `<atom:link rel="self" href="...">` の self URL の組み立て
 * の 3 箇所で参照される。値を変えるならこの定数だけを触れば全経路に反映される。
 */
export const RSS_FEED_PATH = '/feed.xml'

/**
 * RSS `<channel>` の `<title>`。
 *
 * `nuxt.config.ts` の `app.head.title` と揃えることで、
 * フィードリーダー上とブラウザタブのサイト表記を一致させる。
 */
export const SITE_TITLE = 'Nozomi Hosaka'

/**
 * RSS `<channel>` の `<description>`。
 *
 * `nuxt.config.ts` の `app.head.meta` 内の `description` と揃える。
 * フィードリーダー上でサイトの概要として表示される。
 */
export const SITE_DESCRIPTION = 'Nozomi Hosaka の個人サイト'

/**
 * RSS `<channel>` の `<language>`。RFC 4646 準拠。
 *
 * 日本語コンテンツ主体のサイトのため `ja` 固定。多言語化する場合は
 * `<item>` 単位での言語指定が必要になるが、Phase 4 時点では scope 外。
 */
export const SITE_LANGUAGE = 'ja'
