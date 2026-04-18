import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTagIndex } from '../../../composables/useTagIndex'
import { TAGS_INDEX_PUBLIC_PATH } from '../../../constants/tags'

/**
 * `useTagIndex` の単体テスト。
 *
 * Nuxt auto-imported な `$fetch` を globalThis に割り当てた mock で置換し、
 * 以下の境界条件を検証する:
 *   - 正常系 (200 + 想定 shape) → パース済みマップを返す
 *   - 404 (reject) → 空マップ
 *   - 配列 / null / primitive → 空マップ (fail-safe)
 *   - 値が配列でない key → 無視
 *   - 値の配列内に non-string 要素混入 → string 要素のみ採用
 *   - 呼び出し先のパスが `TAGS_INDEX_PUBLIC_PATH` と一致することを確認
 */
describe('useTagIndex', () => {
  // SSR/クライアント問わず `$fetch` は Nuxt の auto-import で Global に近い形で
  // 利用可能になる。vitest 環境では自動で注入されないため、globalThis に
  // 直接セットして mock として扱う。
  let fetchSpy: ReturnType<typeof vi.fn>
  const originalFetch = (globalThis as { $fetch?: unknown }).$fetch

  beforeEach(() => {
    fetchSpy = vi.fn()
    ;(globalThis as { $fetch?: unknown }).$fetch = fetchSpy
  })

  afterEach(() => {
    if (originalFetch === undefined) {
      delete (globalThis as { $fetch?: unknown }).$fetch
    }
    else {
      ;(globalThis as { $fetch?: unknown }).$fetch = originalFetch
    }
  })

  it('returns the parsed map on success', async () => {
    fetchSpy.mockResolvedValue({
      blog: ['welcome', 'hello'],
      announcement: ['welcome'],
    })
    const result = await useTagIndex()
    expect(result).toEqual({
      blog: ['welcome', 'hello'],
      announcement: ['welcome'],
    })
    expect(fetchSpy).toHaveBeenCalledWith(TAGS_INDEX_PUBLIC_PATH)
  })

  it('returns {} when fetch rejects (e.g. 404 or network error)', async () => {
    fetchSpy.mockRejectedValue(new Error('404 Not Found'))
    const result = await useTagIndex()
    expect(result).toEqual({})
  })

  it('returns {} when the response is null', async () => {
    fetchSpy.mockResolvedValue(null)
    const result = await useTagIndex()
    expect(result).toEqual({})
  })

  it('returns {} when the response is an array', async () => {
    fetchSpy.mockResolvedValue(['blog'])
    const result = await useTagIndex()
    expect(result).toEqual({})
  })

  it('returns {} when the response is a primitive', async () => {
    fetchSpy.mockResolvedValue('not-an-object')
    const result = await useTagIndex()
    expect(result).toEqual({})
  })

  it('skips keys whose values are not arrays', async () => {
    fetchSpy.mockResolvedValue({
      blog: ['welcome'],
      broken: 'not-an-array',
      alsoBroken: 42,
      nested: { nope: ['x'] },
    })
    const result = await useTagIndex()
    expect(result).toEqual({ blog: ['welcome'] })
  })

  it('filters out non-string elements within arrays and drops empty buckets', () => {
    fetchSpy.mockResolvedValue({
      mixed: ['ok', 42, null, 'also-ok'],
      empty: [1, 2, 3],
    })
    return useTagIndex().then((result) => {
      expect(result).toEqual({ mixed: ['ok', 'also-ok'] })
      expect(result).not.toHaveProperty('empty')
    })
  })
})
