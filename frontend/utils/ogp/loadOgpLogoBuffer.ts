/**
 * OGP テンプレートに焼き込むロゴ画像 (PNG) を読み込む薄いラッパ。
 *
 * 設計上の対称性:
 *   `loadOgpLogoBuffer` は I/O のみを担当し、エラーは catch せず
 *   そのまま投げる (fail-closed)。`generateArticleOgp` 等の純関数側は
 *   buffer / data URI を受け取るだけで、ファイル読み込みに対する責務は
 *   持たない。caller (`nuxt.config.ts`) が:
 *     1. `loadOgpLogoBuffer(absolutePath)` で Buffer を取得
 *     2. `data:image/png;base64,${buffer.toString('base64')}` で data URI 化
 *     3. `normalizeLogoDataUri` で prefix 検証
 *   の順に呼ぶ。設計 v2 Step 15-16 / Step 21。
 */
import { readFileSync } from 'node:fs'

/**
 * 指定された絶対パスから PNG Buffer を返す。
 *
 * 失敗時 (ファイルなし、権限不足など) は `readFileSync` がそのまま
 * throw し、build を fail-closed させる。caller 側で catch すると
 * 「ロゴ抜きの OGP が量産される」事故が起きるため、ここでは
 * 意図的に握り潰さない。
 *
 * @param absolutePath PNG ファイルへの絶対パス
 */
export function loadOgpLogoBuffer(absolutePath: string): Buffer {
  return readFileSync(absolutePath)
}
