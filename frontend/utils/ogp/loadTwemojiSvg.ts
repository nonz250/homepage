/**
 * 絵文字文字 → Twemoji SVG の data URI を返す純関数。
 *
 * 役割:
 *   - 絵文字 (grapheme cluster) からコードポイント列を抽出
 *   - `@twemoji/svg` パッケージ配下の `<codepoints>.svg` をローカルから読み込む
 *   - `data:image/svg+xml;base64,...` 形式の data URI を返す
 *
 * ネットワーク fetch は一切行わない (ビルド時にオフラインで動作する)。
 *
 * Satori の `loadAdditionalAsset` から呼ばれる想定。Satori は `code === 'emoji'`
 * のときに絵文字セグメントを渡してくるため、本関数が data URI を返せば
 * Satori 側で `<img>` として扱われる。
 *
 * 見つからない絵文字は null を返し、呼出側で生の文字列にフォールバックさせる。
 *
 * Twemoji のファイル名規約 (v15):
 *   - 単一コードポイント: `<hex>.svg` (例: `1f4dd.svg`)
 *   - ZWJ シーケンス: `-` 区切り (例: `1f408-200d-2b1b.svg`)
 *   - 単独の異体字セレクタ `U+FE0F` はファイル名上は省略される
 *     (例: `U+2764 U+FE0F` → `2764.svg`)。ただし ZWJ 込みの複合では
 *     `fe0f` が残るケースもあるため、まずそのままで試し、無ければ
 *     FE0F を除去した fallback を試すアプローチにしておく。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 異体字セレクタ (emoji presentation) のコードポイント */
const VARIATION_SELECTOR_16 = 0xfe0f

/**
 * パッケージがインストールされているディレクトリ。
 *
 * `import.meta.resolve` は Node 24 でも一部の環境で synchronous にならない
 * ため、本関数はモジュール解決時の `import.meta.url` を基準に相対パスを組み立て
 * てデフォルトディレクトリを算出する。テスト側から `deps.svgDir` を渡すこと
 * で差し替え可能にしている。
 */
function defaultSvgDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // frontend/utils/ogp/ から frontend/node_modules/@twemoji/svg/ へ
  return resolve(here, '../../node_modules/@twemoji/svg')
}

/**
 * 絵文字 (grapheme cluster) をコードポイント列に分解する。
 *
 * for-of で文字列を反復するとサロゲートペアを考慮した「コードポイント単位」
 * のイテレーションになるため、`String.prototype.codePointAt` と合わせて
 * コードポイント配列を得る。
 */
export function toCodePoints(emoji: string): number[] {
  const result: number[] = []
  for (const char of emoji) {
    const cp = char.codePointAt(0)
    if (cp !== undefined) {
      result.push(cp)
    }
  }
  return result
}

/** コードポイント列を Twemoji ファイル名形式 (hex, `-` 区切り) に整形する */
function codePointsToFileName(codePoints: readonly number[]): string {
  return codePoints.map((cp) => cp.toString(16)).join('-')
}

/**
 * `fs.readFile` の最小インターフェース。
 *
 * 本モジュールは絶対パスの string しか渡さないため、型を string 固定に絞って
 * テストの fake を書きやすくしている。`node:fs/promises` の `readFile` は
 * この形に構造的に互換 (オーバーロードのうち「string を第 1 引数に取る」形が
 * 存在する)。
 */
export interface TwemojiSvgFs {
  readFile(path: string): Promise<Buffer>
}

/**
 * 依存注入コンテナ。テスト時に fs と svgDir を差し替えるための入口。
 */
export interface LoadTwemojiSvgDeps {
  /** node:fs/promises 相当の差し替え先。指定なしなら動的 import する */
  readonly fs?: TwemojiSvgFs
  /** Twemoji SVG が置かれているディレクトリ。未指定時は node_modules を推定 */
  readonly svgDir?: string
}

async function loadDefaultFs(): Promise<TwemojiSvgFs> {
  const mod = await import('node:fs/promises')
  return {
    readFile: (path) => mod.readFile(path),
  }
}

/**
 * 与えられたファイル名で SVG を読み込む。見つからなければ null。
 */
async function readSvg(
  fs: TwemojiSvgFs,
  svgDir: string,
  fileName: string,
): Promise<string | null> {
  try {
    const path = resolve(svgDir, fileName)
    const buffer = await fs.readFile(path)
    return buffer.toString('utf8')
  }
  catch {
    return null
  }
}

/**
 * SVG 文字列を `data:image/svg+xml;base64,...` 形式の data URI に変換する。
 */
function toDataUri(svg: string): string {
  const base64 = Buffer.from(svg, 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * 絵文字 1 字 (grapheme cluster) を受け取り、Twemoji SVG の data URI を返す。
 *
 * @param emoji 絵文字文字列 (例: `"📝"`, `"👨‍👩‍👧"`)
 * @param deps  テスト用依存注入。未指定時は node:fs/promises と node_modules
 *              内の `@twemoji/svg` を使う
 * @returns     data URI 文字列。該当 SVG が見つからない場合は null
 */
export async function loadTwemojiSvg(
  emoji: string,
  deps?: LoadTwemojiSvgDeps,
): Promise<string | null> {
  if (emoji === '') {
    return null
  }
  const fs = deps?.fs ?? (await loadDefaultFs())
  const svgDir = deps?.svgDir ?? defaultSvgDir()

  const codePoints = toCodePoints(emoji)
  if (codePoints.length === 0) {
    return null
  }

  // 1) まずはそのままの codepoint 列でファイル名を作る
  const primary = `${codePointsToFileName(codePoints)}.svg`
  const primarySvg = await readSvg(fs, svgDir, primary)
  if (primarySvg !== null) {
    return toDataUri(primarySvg)
  }

  // 2) 見つからなければ FE0F (variation selector-16) を除去して再試行。
  //    Twemoji は単一絵文字 (例: U+2764 U+FE0F) のときに FE0F を
  //    ファイル名から落とす規約のため。
  const withoutFe0f = codePoints.filter((cp) => cp !== VARIATION_SELECTOR_16)
  if (
    withoutFe0f.length > 0 &&
    withoutFe0f.length !== codePoints.length
  ) {
    const fallback = `${codePointsToFileName(withoutFe0f)}.svg`
    const fallbackSvg = await readSvg(fs, svgDir, fallback)
    if (fallbackSvg !== null) {
      return toDataUri(fallbackSvg)
    }
  }

  return null
}
