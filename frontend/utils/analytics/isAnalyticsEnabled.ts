/**
 * GA4 測定を有効化するかの判定ロジックを純関数に切り出す。
 *
 * 有効化条件 (AND):
 *   1. `nodeEnv === 'production'` (本番ビルドでのみ計測)
 *   2. `gtagId` が GA4 測定 ID の形式 (`G-` で始まる英数字) に一致
 *
 * いずれかを満たさない場合は `false` を返し、plugin 側で gtag.js の
 * 読み込み自体をスキップする (fail-closed)。`CONTENT_PREVIEW` の有無は
 * ここでは判定しない — preview ビルドは `NODE_ENV=production` にならない
 * 想定なので node_env ガードで一緒に落ちる。
 */

/**
 * GA4 測定 ID (`G-XXXXXXXXXX`) のフォーマットを検証する純関数。
 *
 * 形式チェックの意図:
 *   - `runtimeConfig.public.gtagId` にユーザー / Secrets の誤入力値
 *     (`G-` プレフィクスのないタグマネージャ ID や空文字) が入っていた
 *     場合に、`<script>` タグは埋め込まれても GA 側が成立しないので
 *     ビルド時に `enabled: false` に倒して読み込み自体を抑止する。
 *   - 形式検査は十分な強度ではないが、タイポ耐性としては有効。
 *
 * GA4 の measurement ID は 10〜12 桁の英数字 (大文字) が慣例なので、
 * 境界を緩めに `[A-Z0-9]{6,}` とする。
 */
const GTAG_ID_PATTERN = /^G-[A-Z0-9]{6,}$/

/**
 * GA4 measurement ID として受理可能な文字列かを判定する純関数。
 * 空文字や `undefined` は false を返す。
 */
export function isValidGtagId(id: string | undefined | null): boolean {
  if (!id) {
    return false
  }
  return GTAG_ID_PATTERN.test(id)
}

export type AnalyticsGateInput = {
  readonly nodeEnv: string | undefined
  readonly gtagId: string | undefined | null
}

/**
 * GA4 の送信を有効にすべきかを判定する純関数。
 *
 * 実ビルド時の `nuxt.config.ts` での `process.env.NODE_ENV` と、
 * `runtimeConfig.public.gtagId` (= `process.env.NUXT_PUBLIC_GTAG_ID` ?? '')
 * を入力として受け取り、単一の真偽値に畳み込む。
 */
export function isAnalyticsEnabled(input: AnalyticsGateInput): boolean {
  return input.nodeEnv === 'production' && isValidGtagId(input.gtagId)
}
