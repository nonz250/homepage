/**
 * `utils/ogp/generateArticleOgp.ts` を実フォントで動かす integration テスト。
 *
 * unit テスト (generateArticleOgp.test.ts) は最小ケース 1-2 件だけを検証する。
 * ここでは「タイトルの幅・禁則・ASCII 混在等で wrapOgpTitle のフォールバック
 * パスを通したときにも実際の Satori + resvg が PNG を生成できること」を確認
 * する。PNG のピクセル一致はフォントの揺れで安定しないため、シグネチャと
 * サイズ予算 (< 300KB) のみアサートする。
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

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

const MAX_PNG_SIZE = 300 * 1024

const TITLE_VARIANTS: readonly string[] = [
  '短い',
  'ちょうど中くらいの長さの日本語タイトルのサンプルです',
  '非常に長いタイトル'.repeat(8),
  '前の話「鍵括弧の中身」の後に、続きの文章。さらに句点。',
  '日本語ai-rotomを使うサンプルタイトル mixed ASCII 入り',
] as const

function buildInput(title: string): SafeOgpInput {
  return {
    title: toSafeText(title, 120),
    date: toSafeText('2026-05-23', 32),
    tags: [],
    theme: 'light',
  }
}

describe('article OGP render (real fonts, varied titles)', () => {
  const fontBuffer = readFileSync(FONT_PATH)

  it.each(TITLE_VARIANTS)(
    'renders a valid PNG under size budget for %s',
    async (title) => {
      const png = await generateArticleOgp(buildInput(title), { fontBuffer })
      expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
      expect(png.length).toBeLessThan(MAX_PNG_SIZE)
    },
    30_000,
  )
})
