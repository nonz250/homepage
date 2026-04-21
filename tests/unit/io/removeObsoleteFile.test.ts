import { describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { removeObsoleteFile } from '../../../scripts/lib/io/removeObsoleteFile'

describe('removeObsoleteFile', () => {
  function tempDir(): string {
    return mkdtempSync(join(tmpdir(), 'remove-obsolete-'))
  }

  it('removes the file when it exists', () => {
    const dir = tempDir()
    const target = join(dir, 'foo.md')
    writeFileSync(target, 'body')
    expect(existsSync(target)).toBe(true)
    removeObsoleteFile(target)
    expect(existsSync(target)).toBe(false)
  })

  it('is a no-op when the file does not exist', () => {
    const dir = tempDir()
    const target = join(dir, 'missing.md')
    expect(() => removeObsoleteFile(target)).not.toThrow()
    expect(existsSync(target)).toBe(false)
  })

  it('throws when the path points to a directory (safety)', () => {
    const dir = tempDir()
    const sub = join(dir, 'subdir')
    mkdirSync(sub)
    expect(() => removeObsoleteFile(sub)).toThrow()
  })
})
