import { describe, expect, it } from 'vitest'
import { flattenTocLinks } from '../../../utils/article/flattenTocLinks'

/**
 * Nuxt Content が生成するネスト TOC を ArticleToc コンポーネント用に
 * 平坦化する純関数のテスト。preorder 走査と欠損フィールドの扱いを
 * 明示的に固定する。
 */
describe('flattenTocLinks', () => {
  it('returns an empty array when input is undefined', () => {
    expect(flattenTocLinks(undefined)).toEqual([])
  })

  it('returns an empty array for a non-array input', () => {
    expect(flattenTocLinks('oops' as unknown as undefined)).toEqual([])
  })

  it('preserves flat links as-is', () => {
    expect(
      flattenTocLinks([
        { id: 'a', text: 'A', depth: 2 },
        { id: 'b', text: 'B', depth: 2 },
      ]),
    ).toEqual([
      { id: 'a', text: 'A', depth: 2 },
      { id: 'b', text: 'B', depth: 2 },
    ])
  })

  it('flattens nested children in preorder', () => {
    const result = flattenTocLinks([
      {
        id: 'a',
        text: 'A',
        depth: 2,
        children: [
          { id: 'a1', text: 'A-1', depth: 3 },
          { id: 'a2', text: 'A-2', depth: 3 },
        ],
      },
      { id: 'b', text: 'B', depth: 2 },
    ])
    expect(result.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'b'])
  })

  it('skips links missing id / text / depth', () => {
    const result = flattenTocLinks([
      { id: 'ok', text: 'OK', depth: 2 },
      { text: 'no-id', depth: 2 },
      { id: 'no-text', depth: 2 },
      { id: 'no-depth', text: 'x' },
    ])
    expect(result.map((r) => r.id)).toEqual(['ok'])
  })

  it('still traverses children of a malformed parent', () => {
    const result = flattenTocLinks([
      {
        // parent が壊れていても children が生きていれば拾う
        children: [{ id: 'survivor', text: 's', depth: 3 }],
      },
    ])
    expect(result).toEqual([{ id: 'survivor', text: 's', depth: 3 }])
  })
})
