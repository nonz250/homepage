import { describe, expect, it } from 'vitest'
import { assertSafeImagePath } from '../../scripts/lib/image-path-validator'

/**
 * 画像パスの allowlist + path.normalize 二重チェックのテスト。
 *
 * transformImage 側で IMAGE_PATH_PATTERN regex の検査は済むが、同じ経路を
 * 別実装 (path.posix.normalize) で再検証することで、regex の盲点を突く
 * 攻撃 (例: 重スラッシュ / 末尾ドット / Unicode 正規化) を fail-closed で
 * 検知する。
 */
describe('assertSafeImagePath', () => {
  describe('accepts canonical local image paths', () => {
    it('accepts a simple /images/ path', () => {
      expect(() => assertSafeImagePath('/images/foo.png')).not.toThrow()
    })

    it('accepts nested paths', () => {
      expect(() =>
        assertSafeImagePath('/images/ai-rotom/sample1.png'),
      ).not.toThrow()
    })

    it('accepts multiple allowed extensions', () => {
      for (const path of [
        '/images/a.png',
        '/images/a.jpg',
        '/images/a.jpeg',
        '/images/a.gif',
        '/images/a.webp',
        '/images/a.svg',
      ]) {
        expect(() => assertSafeImagePath(path)).not.toThrow()
      }
    })
  })

  describe('rejects path traversal and special characters', () => {
    it('rejects ".." segments', () => {
      expect(() => assertSafeImagePath('/images/../secret.png')).toThrow()
    })

    it('rejects "./" segments', () => {
      expect(() => assertSafeImagePath('/images/./a.png')).toThrow()
    })

    it('rejects double slashes', () => {
      expect(() => assertSafeImagePath('/images//a.png')).toThrow()
    })

    it('rejects paths that do not start with /images/', () => {
      expect(() => assertSafeImagePath('/imagex/a.png')).toThrow()
      expect(() => assertSafeImagePath('images/a.png')).toThrow()
      expect(() => assertSafeImagePath('/other/a.png')).toThrow()
    })

    it('rejects disallowed extensions', () => {
      expect(() => assertSafeImagePath('/images/a.exe')).toThrow()
      expect(() => assertSafeImagePath('/images/a')).toThrow()
    })

    it('rejects absolute URLs', () => {
      expect(() =>
        assertSafeImagePath('https://example.com/images/a.png'),
      ).toThrow()
    })

    it('rejects empty string', () => {
      expect(() => assertSafeImagePath('')).toThrow()
    })

    it('rejects backslash separators', () => {
      expect(() => assertSafeImagePath('\\images\\a.png')).toThrow()
    })

    it('rejects embedded NUL byte', () => {
      expect(() => assertSafeImagePath('/images/a\u0000.png')).toThrow()
    })

    it('rejects traversal that path.normalize reduces back to /images/', () => {
      // regex 単独では `/images/foo/../bar.png` のような書き方を通してしまう
      // 可能性があるため、`..` 単体の文字列検査で fail-closed にする。
      expect(() =>
        assertSafeImagePath('/images/foo/../bar.png'),
      ).toThrow()
    })
  })
})
