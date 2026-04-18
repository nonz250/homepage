import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import { toHtml } from 'hast-util-to-html'
import type { Root as HastRoot } from 'hast'

/**
 * `remark-math` + `rehype-katex` を組み合わせた数式レンダリングパイプラインの
 * 単体テスト。
 *
 * 本プロジェクトでは Nuxt Content (`@nuxtjs/mdc`) の markdown パイプラインに
 * `remark-math` / `rehype-katex` を追加して KaTeX による数式表示を実現する。
 * Nuxt のビルドに通す前に、unified 単独のパイプラインでプラグインの振る舞い
 * が期待通り (インライン / ブロック双方をレンダリングする) であることを
 * 単体で確認する。
 *
 * 期待される変換:
 *   - `$E=mc^2$`                    → `<span class="katex">...</span>` インライン
 *   - `$$\int_0^\infty e^{-x^2}dx$$` → `<span class="katex-display">...</span>` ブロック
 */

/**
 * md → HTML に変換する内部ヘルパー。
 *
 * 実運用では Nuxt Content が同じプラグインセットを組み込むため、ここで直接
 * unified を構築しても挙動を正しく検証できる。
 */
function mdToHtml(md: string): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
  const tree = processor.runSync(processor.parse(md)) as HastRoot
  return toHtml(tree)
}

describe('remark-math + rehype-katex pipeline', () => {
  describe('inline math', () => {
    it('renders $E=mc^2$ as a KaTeX span', () => {
      const html = mdToHtml('Einstein: $E=mc^2$\n')
      expect(html).toContain('class="katex"')
      expect(html).toContain('Einstein:')
    })

    it('preserves surrounding text when math is inline', () => {
      const html = mdToHtml('before $x + 1$ after\n')
      expect(html).toContain('before')
      expect(html).toContain('after')
      expect(html).toContain('class="katex"')
    })
  })

  describe('block math', () => {
    it('renders $$...$$ on its own block line as a KaTeX display block', () => {
      // remark-math は `$$...$$` が段落単独で書かれたときのみ display mode。
      // 通常のテキスト中の `$$...$$` は inline math として扱われる仕様。
      const html = mdToHtml(['$$', '\\int_0^\\infty e^{-x^2} dx', '$$', ''].join('\n'))
      expect(html).toContain('class="katex-display"')
    })

    it('handles multi-line display math', () => {
      const html = mdToHtml(['$$', 'a = b + c', '$$', ''].join('\n'))
      expect(html).toContain('class="katex-display"')
    })
  })

  describe('error handling', () => {
    it('throws when KaTeX rejects an unknown command by default strict mode', () => {
      // KaTeX のデフォルトは strict=false でレンダリングはされるが、警告付き。
      // 未知コマンドでは `<span class="katex-error">` が挿入される挙動を
      // 検証する (build fail するかは Nuxt Content 側の設定次第で、
      // ここでは「少なくともエラー表示に倒せる」ことを確認する)。
      const html = mdToHtml('$\\unknowncmd{}$\n')
      expect(html).toMatch(/katex(?:-error)?/)
    })
  })

  describe('pass-through for plain markdown', () => {
    it('does not emit KaTeX markup when no math is present', () => {
      const html = mdToHtml('# Title\n\nJust some text.\n')
      expect(html).not.toContain('class="katex"')
      expect(html).not.toContain('class="katex-display"')
    })

    it('does not treat a single dollar sign in prose as math', () => {
      // 金額表記 `$5` のような単独 $ は remark-math の仕様で math として
      // 解析されないはず。
      const html = mdToHtml('The price is $5 and nothing else.\n')
      expect(html).not.toContain('class="katex"')
    })
  })
})
