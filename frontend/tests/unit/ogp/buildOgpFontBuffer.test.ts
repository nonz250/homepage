/**
 * `utils/ogp/buildOgpFontBuffer.ts` のユニットテスト。
 *
 * ここでは subset-font / readSourceFont を完全 mock し、
 * 純関数的な振る舞い (入力連結 / fail-closed) を検証する。
 *
 * 実 subset-font を使った production-like な検証は
 * `tests/integration/ogp/buildOgpFontBuffer.test.ts` (Step 5) で行う。
 */
import { describe, expect, it, vi } from 'vitest'
import { buildOgpFontBuffer } from '../../../utils/ogp/buildOgpFontBuffer'
import { OGP_FONT_FIXED_CHARACTERS } from '../../../constants/ogpFont'

const DUMMY_SOURCE = Buffer.from([1, 2, 3, 4])
const DUMMY_OUTPUT = Buffer.from([0xff, 0xfe, 0xfd])

describe('buildOgpFontBuffer (unit / mocked)', () => {
  it('passes the union of fixedCharacters and entry titles to subset-font', async () => {
    const subsetFont = vi.fn().mockResolvedValue(DUMMY_OUTPUT)
    const readSourceFont = vi.fn().mockReturnValue(DUMMY_SOURCE)
    const out = await buildOgpFontBuffer(
      {
        entries: [
          { slug: 'rust', title: '鯖を読む技術' },
          { slug: 'fish', title: '魚を捌く心得' },
        ],
        fixedCharacters: 'abc',
      },
      { subsetFont, readSourceFont },
    )
    expect(out).toBe(DUMMY_OUTPUT)
    expect(subsetFont).toHaveBeenCalledTimes(1)
    const [sourceArg, textArg, optsArg] = subsetFont.mock.calls[0]
    expect(sourceArg).toBe(DUMMY_SOURCE)
    expect(typeof textArg).toBe('string')
    // 固定文字 + 記事タイトルが全て含まれる
    for (const ch of 'abc') expect(textArg).toContain(ch)
    for (const ch of '鯖を読む技術') expect(textArg).toContain(ch)
    for (const ch of '魚を捌く心得') expect(textArg).toContain(ch)
    expect(optsArg).toEqual({ targetFormat: 'woff' })
  })

  it('deduplicates characters (set semantics)', async () => {
    const subsetFont = vi.fn().mockResolvedValue(DUMMY_OUTPUT)
    const readSourceFont = vi.fn().mockReturnValue(DUMMY_SOURCE)
    await buildOgpFontBuffer(
      {
        entries: [{ slug: 'a', title: 'aaaa' }],
        fixedCharacters: 'aa',
      },
      { subsetFont, readSourceFont },
    )
    const [, textArg] = subsetFont.mock.calls[0]
    expect((textArg as string).match(/a/g)?.length).toBe(1)
  })

  it('removes lone surrogates from titles before subset', async () => {
    const subsetFont = vi.fn().mockResolvedValue(DUMMY_OUTPUT)
    const readSourceFont = vi.fn().mockReturnValue(DUMMY_SOURCE)
    const lone = String.fromCharCode(0xd83d) // 単独 high surrogate
    await buildOgpFontBuffer(
      {
        entries: [{ slug: 'broken', title: `safe${lone}text` }],
        fixedCharacters: '',
      },
      { subsetFont, readSourceFont },
    )
    const [, textArg] = subsetFont.mock.calls[0]
    expect(textArg as string).not.toContain(lone)
  })

  it('rethrows with slug + title preview when subset-font fails', async () => {
    const failure = new Error('boom')
    const subsetFont = vi.fn().mockRejectedValue(failure)
    const readSourceFont = vi.fn().mockReturnValue(DUMMY_SOURCE)
    await expect(
      buildOgpFontBuffer(
        {
          entries: [
            { slug: 'broken', title: '巨大な見出しタイトル' },
          ],
          fixedCharacters: '',
        },
        { subsetFont, readSourceFont },
      ),
    ).rejects.toThrowError(/broken/)
  })

  it('truncates very long title in error preview', async () => {
    const subsetFont = vi.fn().mockRejectedValue(new Error('boom'))
    const readSourceFont = vi.fn().mockReturnValue(DUMMY_SOURCE)
    const longTitle = 'あ'.repeat(80)
    try {
      await buildOgpFontBuffer(
        {
          entries: [{ slug: 'big', title: longTitle }],
          fixedCharacters: '',
        },
        { subsetFont, readSourceFont },
      )
      throw new Error('should have thrown')
    } catch (err) {
      const msg = (err as Error).message
      expect(msg).toContain('big')
      // 40 文字でカットされ、末尾に省略記号が付く
      expect(msg).toContain('…')
    }
  })

  it('uses OGP_FONT_FIXED_CHARACTERS verbatim when caller wires it', async () => {
    // caller (nuxt.config.ts) が constants をそのまま渡す経路の sanity check
    const subsetFont = vi.fn().mockResolvedValue(DUMMY_OUTPUT)
    const readSourceFont = vi.fn().mockReturnValue(DUMMY_SOURCE)
    await buildOgpFontBuffer(
      {
        entries: [],
        fixedCharacters: OGP_FONT_FIXED_CHARACTERS,
      },
      { subsetFont, readSourceFont },
    )
    const [, textArg] = subsetFont.mock.calls[0]
    for (const ch of '0123456789') expect(textArg).toContain(ch)
    for (const ch of '年月日') expect(textArg).toContain(ch)
  })
})
