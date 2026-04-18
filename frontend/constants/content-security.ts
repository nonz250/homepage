/**
 * コンテンツの取り扱いに関するセキュリティ関連定数。
 *
 * マジックストリングの散在を防ぎ、変更時の影響範囲を 1 箇所に集約する。
 * 将来フェーズ (sanitize 強化、HTML allow-list) でも同モジュールを
 * 参照点とすることで「どこに書かれているか」の迷いを無くす目的。
 */

/**
 * 下書き (published=false) が build artifact に漏れていないかを検知するための
 * マーカー文字列。fixture 記事 `articles/draft-feature.md` の本文末尾に
 * このトークンを仕込んでおき、generate 後に `.output/public/` を走査して
 * 検出されないことを確認するために使う (将来フェーズのスキャン向け)。
 */
export const DRAFT_MARKER = '__DRAFT_MARKER__'

/**
 * 記事画像を公開配信する際の URL プレフィックス。
 * nuxt.config.ts の `nitro.publicAssets.baseURL` と一致している必要がある。
 */
export const ARTICLES_IMAGES_PUBLIC_PATH = '/articles-images/'

/**
 * Zenn Connect 互換で記事 Markdown 中に書かれる画像の参照プレフィックス。
 * `![](/images/xxx.png)` の形で書かれた相対参照を
 * `/articles-images/xxx.png` に書き換えるための起点。
 */
export const ARTICLES_IMAGES_SOURCE_PATH = '/images/'
