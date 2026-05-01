/**
 * `utils/ogp/loadOgpLogoBuffer.ts` のユニットテスト。
 *
 * 一時ファイルを作って正常系 (Buffer が返る) と異常系
 * (存在しないパスは throw) の両方を確認する。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadOgpLogoBuffer } from '../../../utils/ogp/loadOgpLogoBuffer'

const SAMPLE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00])

describe('loadOgpLogoBuffer', () => {
  let tmp: string
  let logoPath: string

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'logo-test-'))
    logoPath = join(tmp, 'sample.png')
    writeFileSync(logoPath, SAMPLE_BYTES)
  })

  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true })
  })

  it('returns the file contents as a Buffer', () => {
    const buf = loadOgpLogoBuffer(logoPath)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.equals(SAMPLE_BYTES)).toBe(true)
  })

  it('throws when the file does not exist (fail-closed)', () => {
    expect(() => loadOgpLogoBuffer(join(tmp, 'missing.png'))).toThrowError()
  })
})
