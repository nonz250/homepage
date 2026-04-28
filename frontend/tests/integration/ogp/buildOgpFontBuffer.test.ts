/**
 * `utils/ogp/buildOgpFontBuffer.ts` の integration test。
 *
 * unit テスト (mock 版) では subset-font の挙動はモックしているため、
 * ここでは実 subset-font を使って:
 *   - 出力が WOFF magic を持つ非空 Buffer であること
 *   - サイズが妥当な範囲 (1KB - 500KB) であること
 *   - 同じ入力で 2 回呼んだとき bit 単位で同一バイト列であること (決定論性)
 * を検証する。
 *
 * 設計 v2 Step 5。timeout 10 秒。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildOgpFontBuffer } from '../../../utils/ogp/buildOgpFontBuffer'
import {
  OGP_FONT_FIXED_CHARACTERS,
  OGP_FONT_SOURCE_RELATIVE,
} from '../../../constants/ogpFont'

const FRONTEND_DIR = resolve(__dirname, '../../..')
const SOURCE_FONT_PATH = resolve(FRONTEND_DIR, OGP_FONT_SOURCE_RELATIVE)

/** WOFF magic ('wOFF' = 0x77 0x4F 0x46 0x46) */
const WOFF_MAGIC = Buffer.from([0x77, 0x4f, 0x46, 0x46])

const MIN_BUFFER_SIZE = 1024
const MAX_BUFFER_SIZE = 500 * 1024

const TIMEOUT_MS = 10_000

describe('buildOgpFontBuffer (integration / real subset-font)', () => {
  it(
    'produces a non-empty WOFF buffer within size budget',
    async () => {
      const buf = await buildOgpFontBuffer(
        {
          entries: [
            { slug: 'rust', title: '鯖を読む技術' },
            { slug: 'fish', title: '魚を捌く心得' },
          ],
          fixedCharacters: OGP_FONT_FIXED_CHARACTERS,
        },
        {
          readSourceFont: () => readFileSync(SOURCE_FONT_PATH),
        },
      )
      expect(Buffer.isBuffer(buf)).toBe(true)
      expect(buf.length).toBeGreaterThanOrEqual(MIN_BUFFER_SIZE)
      expect(buf.length).toBeLessThanOrEqual(MAX_BUFFER_SIZE)
      expect(buf.subarray(0, WOFF_MAGIC.length).equals(WOFF_MAGIC)).toBe(
        true,
      )
    },
    TIMEOUT_MS,
  )

  it(
    'is deterministic: identical input yields identical bytes',
    async () => {
      const input = {
        entries: [
          { slug: 'rust', title: '鯖を読む技術' },
          { slug: 'fish', title: '魚を捌く心得' },
        ],
        fixedCharacters: OGP_FONT_FIXED_CHARACTERS,
      }
      const reader = () => readFileSync(SOURCE_FONT_PATH)
      const a = await buildOgpFontBuffer(input, { readSourceFont: reader })
      const b = await buildOgpFontBuffer(input, { readSourceFont: reader })
      expect(Buffer.compare(a, b)).toBe(0)
    },
    TIMEOUT_MS,
  )
})
