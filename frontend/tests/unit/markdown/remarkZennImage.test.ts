import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkZennImage from '../../../utils/markdown/remarkZennImage'

/**
 * `remarkZennImage` の単体テスト。
 *
 * Phase 1 スコープ (`/images/...` → `/articles-images/...`) の境界を
 * 明示的に検証する。data URL や絶対 URL はここでは素通しとし、Phase 2
 * で sanitize を強化する設計。
 *
 * テストでは unified + remark-parse/stringify を用いて Markdown 入出力の
 * ラウンドトリップを検証する。プラグイン関数が mdast を in-place で編集する
 * ため、stringify 結果で置換が行われたかを確認できる。
 */
function processMarkdown(input: string): string {
  const result = unified()
    .use(remarkParse)
    .use(remarkZennImage)
    .use(remarkStringify)
    .processSync(input)
  return String(result)
}

describe('remarkZennImage', () => {
  describe('rewrite targets', () => {
    it('rewrites /images/foo.png to /articles-images/foo.png', () => {
      const out = processMarkdown('![alt](/images/foo.png)\n')
      expect(out).toContain('/articles-images/foo.png')
      expect(out).not.toContain('/images/foo.png')
    })

    it('preserves the alt text when rewriting', () => {
      const out = processMarkdown('![Cute Cat](/images/cat.jpg)\n')
      expect(out).toContain('Cute Cat')
      expect(out).toContain('/articles-images/cat.jpg')
    })

    it('rewrites nested path segments under /images/', () => {
      const out = processMarkdown('![](/images/sub/deep/pic.png)\n')
      expect(out).toContain('/articles-images/sub/deep/pic.png')
    })

    it('rewrites multiple images in the same document', () => {
      const input = [
        '![a](/images/a.png)',
        '',
        'some text',
        '',
        '![b](/images/b.png)',
        '',
      ].join('\n')
      const out = processMarkdown(input)
      expect(out).toContain('/articles-images/a.png')
      expect(out).toContain('/articles-images/b.png')
      expect(out).not.toMatch(/\(\/images\/[ab]\.png\)/)
    })
  })

  describe('non-targets (passthrough)', () => {
    it('does not rewrite absolute https URLs', () => {
      const out = processMarkdown('![](https://example.com/a.png)\n')
      expect(out).toContain('https://example.com/a.png')
    })

    it('does not rewrite absolute http URLs', () => {
      const out = processMarkdown('![](http://example.com/a.png)\n')
      expect(out).toContain('http://example.com/a.png')
    })

    it('does not rewrite protocol-relative URLs', () => {
      const out = processMarkdown('![](//cdn.example.com/a.png)\n')
      expect(out).toContain('//cdn.example.com/a.png')
    })

    it('does not rewrite relative ./ paths', () => {
      const out = processMarkdown('![](./relative.png)\n')
      expect(out).toContain('./relative.png')
      expect(out).not.toContain('/articles-images/relative.png')
    })

    it('does not rewrite relative ../ paths', () => {
      const out = processMarkdown('![](../up/pic.png)\n')
      expect(out).toContain('../up/pic.png')
    })

    it('passes through data: URLs (Phase 1 scope)', () => {
      const out = processMarkdown(
        '![](data:image/png;base64,iVBORw0KGgo=)\n',
      )
      expect(out).toContain('data:image/png;base64,iVBORw0KGgo=')
    })

    it('does not crash on an empty URL', () => {
      expect(() => processMarkdown('![](<>)\n')).not.toThrow()
    })

    it('does not touch non-image nodes', () => {
      const out = processMarkdown('[link](/images/foo.png)\n')
      expect(out).toContain('/images/foo.png')
      expect(out).not.toContain('/articles-images/foo.png')
    })
  })

  describe('mixed content', () => {
    it('only rewrites target images in a mixed document', () => {
      const input = [
        'intro',
        '',
        '![local](/images/local.png)',
        '',
        '![remote](https://example.com/remote.png)',
        '',
        '![relative](./rel.png)',
        '',
      ].join('\n')
      const out = processMarkdown(input)
      expect(out).toContain('/articles-images/local.png')
      expect(out).toContain('https://example.com/remote.png')
      expect(out).toContain('./rel.png')
    })
  })
})
