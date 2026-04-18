/**
 * `utils/ogp/writeArticleOgpPngs.ts` のユニットテスト。
 *
 * 実際の Satori + resvg を動かして PNG を生成し、ファイル書き込みが期待
 * ディレクトリに行われることを検証する。
 *
 * - 並列度 1 で挙動を固定 (順序保証を確かめるため)
 * - 一時ディレクトリに書き出して後片付けする
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { writeArticleOgpPngs } from '../../../utils/ogp/writeArticleOgpPngs'
import { toSafeText, type SafeOgpInput } from '../../../types/ogp-input'

const FONT_PATH = resolve(
  __dirname,
  '../../../node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff',
)

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

describe('writeArticleOgpPngs', () => {
  let tmp: string

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ogp-test-'))
  })

  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true })
  })

  it(
    'writes one PNG per entry with the expected filename',
    async () => {
      const fontBuffer = readFileSync(FONT_PATH)
      const buildInput = (t: string): SafeOgpInput => ({
        title: toSafeText(t, 120),
        date: toSafeText('2026-04-18', 32),
        tags: [],
        theme: 'light',
      })
      const entries = [
        { slug: 'alpha', input: buildInput('Alpha') },
        { slug: 'beta', input: buildInput('Beta') },
      ]
      const written = await writeArticleOgpPngs(entries, {
        outputDir: tmp,
        fontBuffer,
        concurrency: 1,
      })
      expect(written).toHaveLength(2)
      for (const outPath of written) {
        const buf = readFileSync(outPath)
        expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
      }
    },
    30_000,
  )

  it('creates the output directory if it does not exist', async () => {
    const fontBuffer = readFileSync(FONT_PATH)
    const nested = join(tmp, 'nested', 'dir')
    const entries = [
      {
        slug: 'alpha',
        input: {
          title: toSafeText('Nested', 120),
          date: toSafeText('', 32),
          tags: [],
          theme: 'light' as const,
        },
      },
    ]
    const written = await writeArticleOgpPngs(entries, {
      outputDir: nested,
      fontBuffer,
      concurrency: 1,
    })
    expect(written).toHaveLength(1)
    expect(written[0]).toContain('nested/dir')
  }, 30_000)
})
