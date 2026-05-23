/**
 * OGP テンプレートに `<img src>` として埋め込む logo data URI の
 * 形式を検証 / 正規化する純関数。
 *
 * Satori の `<img>` は data URI を受け付けるが、許可していない
 * data scheme (例: SVG / HTML / JSON 等) を src に流すと予期せぬ
 * レンダリング結果になりうる。本プロジェクトは PNG のみを対象と
 * するため、prefix 一致のホワイトリストで検証する。
 *
 * 設計 v2 Step 15-16 / Sec M-8 補足。
 */

/**
 * 許可する data URI prefix のホワイトリスト。
 * 現状は PNG only。将来 JPEG / WebP をロゴに使う場合はここに追加する。
 */
export const ALLOWED_LOGO_DATA_URI_PREFIXES = [
  'data:image/png;base64,',
] as const

/**
 * caller (`nuxt.config.ts`) から渡された logo data URI を正規化して返す。
 *
 * - undefined / 空文字: ロゴなし扱い (null を返す)
 * - 許可 prefix で始まらない場合: throw する (fail-closed)
 * - それ以外: そのまま返す
 *
 * @param input 任意の data URI 文字列
 */
export function normalizeLogoDataUri(
  input: string | undefined,
): string | null {
  if (input === undefined || input.length === 0) return null
  const ok = ALLOWED_LOGO_DATA_URI_PREFIXES.some((prefix) =>
    input.startsWith(prefix),
  )
  if (!ok) {
    throw new Error(
      `[normalizeLogoDataUri] data URI prefix not allowed. ` +
        `Allowed: ${ALLOWED_LOGO_DATA_URI_PREFIXES.join(', ')}`,
    )
  }
  return input
}
