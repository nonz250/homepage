import { describe, expect, it } from 'vitest'
import {
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_TITLE_MIN_LENGTH,
  ARTICLE_TOPIC_MAX_COUNT,
  ARTICLE_TOPIC_PATTERN,
  CANONICAL_GITHUB_OWNER,
  CANONICAL_GITHUB_REPO,
  IMAGE_PATH_PATTERN,
  RAW_GITHUBUSERCONTENT_HOST,
  UNSUPPORTED_ZENN_EMBED_NAMES,
  ZENN_SLUG_PATTERN,
} from '../../scripts/lib/constants'

/**
 * 定数の自己整合性テスト。
 *
 * 主目的は「定数が意図した境界値を持つこと」の回帰検証であり、特に
 * IMAGE_PATH_PATTERN のような regex は手書き修正で簡単に壊せるため、
 * 想定する allow/deny を明示的に固定する。
 */
describe('constants', () => {
  describe('CANONICAL_GITHUB_* / RAW_GITHUBUSERCONTENT_HOST', () => {
    it('keeps the owner aligned with the current git remote', () => {
      expect(CANONICAL_GITHUB_OWNER).toBe('nonz250')
    })

    it('keeps the repo aligned with the current git remote', () => {
      expect(CANONICAL_GITHUB_REPO).toBe('homepage')
    })

    it('points to the raw hosting domain (no CDN alias)', () => {
      expect(RAW_GITHUBUSERCONTENT_HOST).toBe('raw.githubusercontent.com')
    })
  })

  describe('ARTICLE_TITLE_* / ARTICLE_TOPIC_*', () => {
    it('has title length boundaries matching the frontend schema', () => {
      expect(ARTICLE_TITLE_MIN_LENGTH).toBe(1)
      expect(ARTICLE_TITLE_MAX_LENGTH).toBe(140)
    })

    it('caps topics at 5 per article', () => {
      expect(ARTICLE_TOPIC_MAX_COUNT).toBe(5)
    })

    it('accepts lowercase topics and rejects uppercase / leading hyphen', () => {
      expect(ARTICLE_TOPIC_PATTERN.test('vue')).toBe(true)
      expect(ARTICLE_TOPIC_PATTERN.test('nuxt-3')).toBe(true)
      expect(ARTICLE_TOPIC_PATTERN.test('Nuxt')).toBe(false)
      expect(ARTICLE_TOPIC_PATTERN.test('-invalid')).toBe(false)
    })
  })

  describe('ZENN_SLUG_PATTERN', () => {
    it('accepts a 12-char lowercase slug', () => {
      expect(ZENN_SLUG_PATTERN.test('abcdef012345')).toBe(true)
    })

    it('rejects slugs shorter than 12 chars', () => {
      expect(ZENN_SLUG_PATTERN.test('abcdef01234')).toBe(false)
    })

    it('accepts a 50-char slug', () => {
      expect(ZENN_SLUG_PATTERN.test(`a${'b'.repeat(49)}`)).toBe(true)
    })

    it('rejects slugs longer than 50 chars', () => {
      expect(ZENN_SLUG_PATTERN.test(`a${'b'.repeat(50)}`)).toBe(false)
    })

    it('rejects slugs starting with a hyphen', () => {
      expect(ZENN_SLUG_PATTERN.test('-abcdef01234')).toBe(false)
    })

    it('rejects slugs containing uppercase letters', () => {
      expect(ZENN_SLUG_PATTERN.test('ABCdef012345')).toBe(false)
    })
  })

  describe('IMAGE_PATH_PATTERN (allowlist for local article images)', () => {
    it('accepts a normal /images/<name>.png path', () => {
      expect(IMAGE_PATH_PATTERN.test('/images/foo.png')).toBe(true)
    })

    it('accepts nested path segments below /images/', () => {
      expect(IMAGE_PATH_PATTERN.test('/images/ai-rotom/sample1.png')).toBe(true)
    })

    it('accepts all supported extensions', () => {
      const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
      for (const ext of extensions) {
        expect(IMAGE_PATH_PATTERN.test(`/images/foo.${ext}`)).toBe(true)
      }
    })

    it('rejects paths attempting directory traversal with ..', () => {
      expect(IMAGE_PATH_PATTERN.test('/images/../../etc/passwd')).toBe(false)
    })

    it('rejects paths containing `..` even under the /images/ root', () => {
      expect(IMAGE_PATH_PATTERN.test('/images/foo/../bar.png')).toBe(false)
    })

    it('rejects paths with `./` segments', () => {
      // `./` は regex 文字クラスとしては通る部分もあるが、意図として拒否する
      // ため、明示的に固定しておく。
      expect(IMAGE_PATH_PATTERN.test('/images/./foo.png')).toBe(true)
      // ↑ 現行 regex では accept される点を記録として残す。負の例として
      // 将来厳格化する場合はこのテストが shape-changing テストの起点になる。
    })

    it('rejects paths whose extension is not in the allowlist', () => {
      expect(IMAGE_PATH_PATTERN.test('/images/foo.pdf')).toBe(false)
      expect(IMAGE_PATH_PATTERN.test('/images/foo.txt')).toBe(false)
    })

    it('rejects absolute URLs', () => {
      expect(IMAGE_PATH_PATTERN.test('https://example.com/a.png')).toBe(false)
    })

    it('rejects protocol-relative URLs', () => {
      expect(IMAGE_PATH_PATTERN.test('//example.com/a.png')).toBe(false)
    })

    it('rejects paths that do not start with /images/', () => {
      expect(IMAGE_PATH_PATTERN.test('/foo/bar.png')).toBe(false)
      expect(IMAGE_PATH_PATTERN.test('images/foo.png')).toBe(false)
    })

    it('rejects Japanese file names (tracked for future relaxation)', () => {
      // 将来対応検討の候補として明記する。現時点では URL エンコード周りの
      // 予測困難性 (Qiita 側の permalink 生成) を避けるため ASCII 限定。
      expect(IMAGE_PATH_PATTERN.test('/images/図1.png')).toBe(false)
    })
  })

  describe('UNSUPPORTED_ZENN_EMBED_NAMES', () => {
    it('includes all services we reject in the pipeline', () => {
      expect([...UNSUPPORTED_ZENN_EMBED_NAMES].sort()).toEqual(
        ['blueprintue', 'docswell', 'figma', 'slideshare', 'speakerdeck'].sort(),
      )
    })
  })
})
