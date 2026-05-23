/**
 * 記事タイトル文字を subset した Noto Sans JP の WOFF Buffer を
 * ビルド時に都度生成する純関数 (依存注入で I/O を分離する)。
 *
 * 旧 `scripts/subset-noto-sans-jp.mjs` を build hook 側でオンメモリで
 * 走らせる形にリファクタしたもの。記事追加時に subset を手動で
 * 再生成する運用を撤廃し、新規漢字の豆腐化を未然に防ぐ。
 *
 * 設計原則:
 *   - subset-font / readSourceFont を deps として注入し、
 *     unit test では完全 mock にできる純関数化を達成する
 *   - 失敗時は slug + title プレビュー (40 文字) を載せて
 *     fail-closed で再 throw し、build を確実に止める
 *   - 入力 title は `sanitizeFontInputText` で危険コードポイントを除去
 *
 * 設計 v2 Step 3-4 を参照。
 */
import {
  OGP_FONT_FIXED_CHARACTERS,
  OGP_FONT_TARGET_FORMAT,
} from '../../constants/ogpFont'
import { sanitizeFontInputText } from './sanitizeFontInputText'

/** subset-font が公開する API のうち、本関数が利用するシグネチャ */
export type SubsetFontFn = (
  source: Buffer,
  text: string,
  options: { targetFormat: typeof OGP_FONT_TARGET_FORMAT },
) => Promise<Buffer>

/** ソースフォント Buffer を返す関数。テスト時は dummy buffer を返す */
export type ReadSourceFontFn = () => Buffer

/** エラーメッセージに含めるタイトルプレビューの最大文字数 */
const FONT_INPUT_TITLE_PREVIEW_MAX = 40

/**
 * ビルド時に subset 対象として渡す記事 1 件分の最低限のメタ。
 *
 * `OgpInputEntry` ほどの情報は不要なので、subset 用に細い interface を
 * 用意して結合度を下げる。
 */
export interface BuildOgpFontBufferEntry {
  readonly slug: string
  readonly title: string
}

/**
 * `buildOgpFontBuffer` の入力。
 */
export interface BuildOgpFontBufferInput {
  readonly entries: readonly BuildOgpFontBufferEntry[]
  /** 必ず subset に含める固定文字集合 */
  readonly fixedCharacters: string
}

/**
 * `buildOgpFontBuffer` の依存注入用オプション。
 * 省略すると本番実装 (`subset-font` と `readFileSync`) を解決する。
 */
export interface BuildOgpFontBufferDeps {
  readonly subsetFont?: SubsetFontFn
  readonly readSourceFont?: ReadSourceFontFn
}

/**
 * タイトルの先頭 N 文字を切り出して、エラーメッセージに使うプレビューを作る。
 * 多バイト文字を考慮し codepoint 単位で切る。
 */
function buildTitlePreview(title: string): string {
  if (title.length === 0) return '(empty)'
  const codepoints = Array.from(title)
  if (codepoints.length <= FONT_INPUT_TITLE_PREVIEW_MAX) return title
  return `${codepoints.slice(0, FONT_INPUT_TITLE_PREVIEW_MAX).join('')}…`
}

/**
 * entries の title を全て連結してユニーク文字集合を作る。
 *
 * 副作用なし。Set でユニーク化し、subset-font に渡す文字列を組み立てる。
 */
function buildSubsetText(
  entries: readonly BuildOgpFontBufferEntry[],
  fixedCharacters: string,
): string {
  const set = new Set<string>()
  // for-of で codepoint 単位のイテレーションになる (サロゲートペア対応)
  for (const ch of fixedCharacters) set.add(ch)
  for (const entry of entries) {
    const sanitized = sanitizeFontInputText(entry.title)
    for (const ch of sanitized) set.add(ch)
  }
  return Array.from(set).join('')
}

/**
 * 記事 title 集合を subset 対象に含めた Noto Sans JP の WOFF Buffer を返す。
 *
 * 失敗時は slug + title プレビューを Error メッセージに含めて re-throw する。
 *
 * @param input subset 対象の記事メタと固定文字集合
 * @param deps subset-font / source font reader の依存注入
 */
export async function buildOgpFontBuffer(
  input: BuildOgpFontBufferInput,
  deps: BuildOgpFontBufferDeps = {},
): Promise<Buffer> {
  const subsetFontFn = deps.subsetFont ?? (await resolveDefaultSubsetFont())
  const readSourceFontFn =
    deps.readSourceFont ?? (await resolveDefaultSourceFontReader())

  const text = buildSubsetText(input.entries, input.fixedCharacters)
  const sourceBuffer = readSourceFontFn()
  try {
    return await subsetFontFn(sourceBuffer, text, {
      targetFormat: OGP_FONT_TARGET_FORMAT,
    })
  } catch (cause) {
    // 失敗した記事を絞り込めるよう、プレビュー付きで詳細を上書きする。
    const failingDescriptions = input.entries
      .map(
        (entry) =>
          `${entry.slug}: "${buildTitlePreview(entry.title)}"`,
      )
      .join('; ')
    const original =
      cause instanceof Error ? cause.message : String(cause)
    throw new Error(
      `[buildOgpFontBuffer] subset-font failed for entries [${failingDescriptions}]: ${original}`,
      { cause },
    )
  }
}

/**
 * production 実装の subset-font を遅延 import で解決する。
 * unit test では deps.subsetFont が常に渡るためここは呼ばれない。
 */
async function resolveDefaultSubsetFont(): Promise<SubsetFontFn> {
  const mod = await import('subset-font')
  return mod.default as SubsetFontFn
}

/**
 * production 実装のソースフォント reader を遅延解決する。
 * caller (nuxt.config.ts) からはこの実装ではなく、必ず deps.readSourceFont
 * を注入してプロジェクト固有のパス解決を完結させる想定。fallback の解決を
 * ここに置くと __dirname 解決で曖昧さが出るため、未注入時は明示エラーにする。
 */
async function resolveDefaultSourceFontReader(): Promise<ReadSourceFontFn> {
  return () => {
    throw new Error(
      '[buildOgpFontBuffer] readSourceFont must be injected. ' +
        'Resolve the absolute path to noto-sans-jp WOFF in caller side.',
    )
  }
}
