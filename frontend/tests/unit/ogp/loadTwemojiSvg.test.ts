/**
 * `utils/ogp/loadTwemojiSvg.ts` のユニットテスト。
 *
 * カバー範囲:
 *   - 単一コードポイント絵文字 (📝 = U+1F4DD) → data URI
 *   - ZWJ シーケンス (👨‍👩‍👧) → `-` 区切りのファイル名にマッピング
 *   - FE0F (variation selector-16) のフォールバック
 *   - 空文字入力 → null
 *   - ファイルが存在しないときは null を返す
 *   - data URI が base64 エンコード済みで、正しく decode すると SVG 本体になる
 *
 * ディスク I/O は fake fs (in-memory) で差し替えるため、実際の node_modules を
 * 参照しない。Twemoji パッケージのバージョン差異に影響されないテストになる。
 */
import { describe, expect, it } from 'vitest'
import { loadTwemojiSvg, toCodePoints } from '../../../utils/ogp/loadTwemojiSvg'

/** fake SVG ディレクトリのダミーパス。実ディスクにはアクセスしない */
const SVG_DIR = '/virtual/twemoji-svg'

/** テストで返す SVG の中身 (内容は本質ではないので簡略化) */
const FAKE_SVG_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"></svg>'

/**
 * `node:fs/promises` の `readFile` を差し替えるための fake。
 * 指定したファイル名セットにだけ SVG を返し、それ以外は ENOENT を投げる。
 */
function makeFakeFs(existingFiles: readonly string[]): {
  readFile: (path: string) => Promise<Buffer>
  readCalls: string[]
} {
  const set = new Set(existingFiles)
  const readCalls: string[] = []
  return {
    readCalls,
    async readFile(path: string): Promise<Buffer> {
      readCalls.push(path)
      // path は absolute なので basename 一致で判定する
      const slash = path.lastIndexOf('/')
      const name = slash === -1 ? path : path.slice(slash + 1)
      if (set.has(name)) {
        return Buffer.from(FAKE_SVG_BODY, 'utf8')
      }
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    },
  }
}

describe('toCodePoints', () => {
  it('extracts a single BMP codepoint', () => {
    // U+1F4DD "📝" は非 BMP (サロゲートペア)。for-of で 1 点として扱う
    expect(toCodePoints('📝')).toEqual([0x1f4dd])
  })

  it('extracts each codepoint from a ZWJ sequence', () => {
    // 👨(1f468) + ZWJ(200d) + 👩(1f469) + ZWJ(200d) + 👧(1f467)
    expect(toCodePoints('👨\u200d👩\u200d👧')).toEqual([
      0x1f468,
      0x200d,
      0x1f469,
      0x200d,
      0x1f467,
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(toCodePoints('')).toEqual([])
  })
})

describe('loadTwemojiSvg', () => {
  it('returns null for empty string input', async () => {
    const fs = makeFakeFs([])
    const result = await loadTwemojiSvg('', { fs, svgDir: SVG_DIR })
    expect(result).toBeNull()
  })

  it('returns a base64 data URI for a single-codepoint emoji', async () => {
    const fs = makeFakeFs(['1f4dd.svg'])
    const result = await loadTwemojiSvg('📝', { fs, svgDir: SVG_DIR })
    expect(result).not.toBeNull()
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/)

    // base64 部分を decode して元の SVG に戻ること
    const base64 = result!.slice('data:image/svg+xml;base64,'.length)
    const decoded = Buffer.from(base64, 'base64').toString('utf8')
    expect(decoded).toBe(FAKE_SVG_BODY)
  })

  it('resolves ZWJ sequences using `-` joined codepoints', async () => {
    const fs = makeFakeFs(['1f468-200d-1f469-200d-1f467.svg'])
    const result = await loadTwemojiSvg('👨\u200d👩\u200d👧', {
      fs,
      svgDir: SVG_DIR,
    })
    expect(result).not.toBeNull()
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('falls back to FE0F-stripped filename when primary is missing', async () => {
    // U+2764 + U+FE0F の heart。Twemoji のファイル名は `2764.svg` (FE0F なし)
    const fs = makeFakeFs(['2764.svg'])
    const result = await loadTwemojiSvg('\u2764\ufe0f', {
      fs,
      svgDir: SVG_DIR,
    })
    expect(result).not.toBeNull()
    // 最初に `2764-fe0f.svg` を試し、次に `2764.svg` にフォールバックしている
    expect(fs.readCalls).toHaveLength(2)
    expect(fs.readCalls[0]).toMatch(/2764-fe0f\.svg$/)
    expect(fs.readCalls[1]).toMatch(/2764\.svg$/)
  })

  it('returns null when neither primary nor FE0F-stripped file exists', async () => {
    const fs = makeFakeFs([])
    const result = await loadTwemojiSvg('📝', { fs, svgDir: SVG_DIR })
    expect(result).toBeNull()
  })

  it('does not try FE0F fallback when FE0F is not present', async () => {
    const fs = makeFakeFs([])
    await loadTwemojiSvg('📝', { fs, svgDir: SVG_DIR })
    // primary 1 回だけ (FE0F がないのでフォールバック試行なし)
    expect(fs.readCalls).toHaveLength(1)
  })
})
