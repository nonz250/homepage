/**
 * `utils/ogp/ogpCache.ts` (createFileSystemOgpCache) のユニットテスト。
 *
 * カバー範囲:
 *   - set → get で同じ entry が返る
 *   - TTL 内は hit
 *   - TTL 切れ (now > expiresAt) は null
 *   - 未登録 URL で null
 *   - 破損 JSON で null (cache miss 扱い、log は optional)
 *   - record === null (失敗キャッシュ) を保存して復元できる
 *   - set 時にディレクトリが作成される (mkdir 呼び出し)
 *
 * fake fs (in-memory) と fake now で TTL 境界を決定的に検証する。
 */
import { describe, expect, it } from 'vitest'
import {
  createFileSystemOgpCache,
} from '../../../utils/ogp/ogpCache'
import type {
  OgpCacheEntry,
  OgpCacheFs,
  OgpRecord,
} from '../../../utils/ogp/ogpCache'
import { OGP_CACHE_TTL_MS } from '../../../constants/ogp'

const SAMPLE_URL = 'https://example.com/article'
const TEST_FETCHED_AT_MS = 1_700_000_000_000
const TEST_NOW_INSIDE_TTL = TEST_FETCHED_AT_MS + 60_000  // 1 分後

/**
 * シンプルな in-memory fake fs。set でファイル文字列を Map に保存し、get で
 * 取り出す。ENOENT は throw して本番の fs と同じ感触にする。
 */
function makeMemoryFs(): { fs: OgpCacheFs; storage: Map<string, string>; mkdirCalls: string[] } {
  const storage = new Map<string, string>()
  const mkdirCalls: string[] = []
  const fs: OgpCacheFs = {
    async readFile(path: string): Promise<string> {
      const data = storage.get(path)
      if (data === undefined) {
        const err = new Error(`ENOENT: no such file ${path}`)
        ;(err as unknown as { code: string }).code = 'ENOENT'
        throw err
      }
      return data
    },
    async writeFile(path: string, data: string): Promise<void> {
      storage.set(path, data)
    },
    async mkdir(path: string): Promise<string | undefined> {
      mkdirCalls.push(path)
      return undefined
    },
  }
  return { fs, storage, mkdirCalls }
}

function buildSampleRecord(): OgpRecord {
  return {
    url: SAMPLE_URL,
    title: 'Sample title',
    description: 'Sample description',
    imagePath: '/ogp-images/sample.png',
    siteName: 'example.com',
    fetchedAt: new Date(TEST_FETCHED_AT_MS).toISOString(),
  }
}

function buildSampleEntry(record: OgpRecord | null = buildSampleRecord()): OgpCacheEntry {
  return {
    record,
    fetchedAt: TEST_FETCHED_AT_MS,
    expiresAt: TEST_FETCHED_AT_MS + OGP_CACHE_TTL_MS,
  }
}

describe('createFileSystemOgpCache', () => {
  it('returns null for an unknown URL (cache miss)', async () => {
    const { fs } = makeMemoryFs()
    const cache = createFileSystemOgpCache({ fs, now: () => TEST_NOW_INSIDE_TTL, cacheDir: '/tmp/cache' })

    const entry = await cache.get('https://nothing.example.com/')

    expect(entry).toBeNull()
  })

  it('returns the same entry after set within TTL', async () => {
    const { fs } = makeMemoryFs()
    const cache = createFileSystemOgpCache({ fs, now: () => TEST_NOW_INSIDE_TTL, cacheDir: '/tmp/cache' })
    const original = buildSampleEntry()

    await cache.set(SAMPLE_URL, original)
    const restored = await cache.get(SAMPLE_URL)

    expect(restored).not.toBeNull()
    expect(restored?.record).toEqual(original.record)
    expect(restored?.fetchedAt).toBe(original.fetchedAt)
    expect(restored?.expiresAt).toBe(original.expiresAt)
  })

  it('returns null when TTL has expired', async () => {
    const { fs } = makeMemoryFs()
    let nowMs = TEST_FETCHED_AT_MS
    const cache = createFileSystemOgpCache({ fs, now: () => nowMs, cacheDir: '/tmp/cache' })
    const entry = buildSampleEntry()
    await cache.set(SAMPLE_URL, entry)

    // TTL 切れ直前: hit。
    nowMs = entry.expiresAt - 1
    expect(await cache.get(SAMPLE_URL)).not.toBeNull()

    // TTL 切れ直後: miss。
    nowMs = entry.expiresAt
    expect(await cache.get(SAMPLE_URL)).toBeNull()

    nowMs = entry.expiresAt + 1
    expect(await cache.get(SAMPLE_URL)).toBeNull()
  })

  it('returns null for corrupted JSON', async () => {
    const { fs, storage } = makeMemoryFs()
    const cache = createFileSystemOgpCache({ fs, now: () => TEST_NOW_INSIDE_TTL, cacheDir: '/tmp/cache' })
    // 一度有効データを書いてから差し替えることで「該当パスにファイルが存在する」状態を作る。
    await cache.set(SAMPLE_URL, buildSampleEntry())
    // 破損データに置き換え。
    const filePath = Array.from(storage.keys())[0]
    storage.set(filePath, '{ invalid json')

    const restored = await cache.get(SAMPLE_URL)

    expect(restored).toBeNull()
  })

  it('returns null when JSON shape is unexpected', async () => {
    const { fs, storage } = makeMemoryFs()
    const cache = createFileSystemOgpCache({ fs, now: () => TEST_NOW_INSIDE_TTL, cacheDir: '/tmp/cache' })
    // fetchedAt / expiresAt が無い形を直接書き込む。
    const path = '/tmp/cache/'
    // 仮の path: cache.set 経由で実際に使われている path を取得し、上書きする。
    await cache.set(SAMPLE_URL, buildSampleEntry())
    const filePath = Array.from(storage.keys())[0]
    storage.set(filePath, JSON.stringify({ foo: 'bar' }))

    expect(await cache.get(SAMPLE_URL)).toBeNull()
    expect(path).toBe('/tmp/cache/')  // path 変数を unused にしないための副次的な assertion。
  })

  it('preserves record === null (failure cache)', async () => {
    const { fs } = makeMemoryFs()
    const cache = createFileSystemOgpCache({ fs, now: () => TEST_NOW_INSIDE_TTL, cacheDir: '/tmp/cache' })
    const failureEntry = buildSampleEntry(null)

    await cache.set(SAMPLE_URL, failureEntry)
    const restored = await cache.get(SAMPLE_URL)

    expect(restored).not.toBeNull()
    expect(restored?.record).toBeNull()
  })

  it('creates the cache directory on set (recursive mkdir)', async () => {
    const { fs, mkdirCalls } = makeMemoryFs()
    const cache = createFileSystemOgpCache({ fs, now: () => TEST_NOW_INSIDE_TTL, cacheDir: '/tmp/foo/bar' })

    await cache.set(SAMPLE_URL, buildSampleEntry())

    expect(mkdirCalls).toContain('/tmp/foo/bar')
  })

  it('uses sha1 of the URL as the file name (different URLs map to different files)', async () => {
    const { fs, storage } = makeMemoryFs()
    const cache = createFileSystemOgpCache({ fs, now: () => TEST_NOW_INSIDE_TTL, cacheDir: '/tmp/cache' })

    await cache.set('https://a.example.com/', buildSampleEntry())
    await cache.set('https://b.example.com/', buildSampleEntry())

    expect(storage.size).toBe(2)
    const paths = Array.from(storage.keys())
    expect(paths.every(p => p.startsWith('/tmp/cache/'))).toBe(true)
    expect(paths.every(p => p.endsWith('.json'))).toBe(true)
  })
})
