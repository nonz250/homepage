/**
 * `utils/ogp/generateArticleOgp.ts` のユニットテスト。
 *
 * カバー範囲:
 *   - PNG シグネチャが先頭 8 バイトに含まれる
 *   - IHDR から解釈した寸法が 1200x630 になっている
 *   - サイズ上限 300KB を超えない
 *   - 出力は Buffer 型で、空ではない
 *
 * フォントバッファは `@fontsource/noto-sans-jp` の WOFF ファイルを直接読み込む。
 * サブセット化は Batch B の後段コミットで行う (成果物を commit する設計)。
 * vitest の実行時間を短く保つため、テスト本数を最低限にしている。
 *
 * 設計 v4 C-A に従い、ピクセル一致テストは行わない (フォント描画の揺れの
 * ためアサート不能)。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateArticleOgp } from '../../../utils/ogp/generateArticleOgp'
import { toSafeText, type SafeOgpInput } from '../../../types/ogp-input'

const FONT_PATH = resolve(
  __dirname,
  '../../../node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff',
)

/** PNG ファイルの先頭 8 バイト固定値 (RFC2083) */
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

/** PNG の IHDR チャンクで幅/高さを表すバイト位置 (シグネチャ後すぐに IHDR) */
const IHDR_WIDTH_OFFSET = 16
const IHDR_HEIGHT_OFFSET = 20

/** 出力サイズの上限 (バイト) */
const MAX_PNG_SIZE = 300 * 1024

function readFontBuffer(): Buffer {
  return readFileSync(FONT_PATH)
}

function buildInput(): SafeOgpInput {
  return {
    title: toSafeText('テストタイトル', 120),
    date: toSafeText('2026-04-18', 32),
    tags: [toSafeText('test', 16)],
    emoji: toSafeText('🧪', 4),
    theme: 'light',
  }
}

describe('generateArticleOgp', () => {
  it(
    'produces a PNG buffer with the expected signature and dimensions',
    async () => {
      const fontBuffer = readFontBuffer()
      const png = await generateArticleOgp(buildInput(), { fontBuffer })

      expect(Buffer.isBuffer(png)).toBe(true)
      expect(png.length).toBeGreaterThan(0)
      // PNG シグネチャ (0x89 P N G \r \n SUB \n)
      expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
      // IHDR から寸法を読む (big-endian uint32)
      const width = png.readUInt32BE(IHDR_WIDTH_OFFSET)
      const height = png.readUInt32BE(IHDR_HEIGHT_OFFSET)
      expect(width).toBe(1200)
      expect(height).toBe(630)
      // ファイルサイズの上限
      expect(png.length).toBeLessThan(MAX_PNG_SIZE)
    },
    20_000,
  )

  it('accepts input without emoji', async () => {
    const fontBuffer = readFontBuffer()
    const input: SafeOgpInput = {
      title: toSafeText('no emoji title', 120),
      date: toSafeText('2026-04-18', 32),
      tags: [],
      theme: 'light',
    }
    const png = await generateArticleOgp(input, { fontBuffer })
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
  }, 20_000)
})
