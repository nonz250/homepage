import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import { toHtml } from 'hast-util-to-html'
import type { Root as MdastRoot } from 'mdast'
import type { Root as HastRoot } from 'hast'
import remarkZennImage from '../../../utils/markdown/remarkZennImage'
import remarkZennContainer from '../../../utils/markdown/remarkZennContainer'
import remarkZennEmbed from '../../../utils/markdown/remarkZennEmbed'
import rehypeAssertNoZennLeftovers from '../../../utils/markdown/rehypeAssertNoZennLeftovers'
import {
  ZENN_DETAILS_TAG,
  ZENN_EMBED_YOUTUBE_TAG,
  ZENN_MESSAGE_TAG,
} from '../../../constants/zenn-mdc'

/**
 * Zenn 互換 Markdown → MDC/HTML 変換パイプライン全体の統合テスト。
 *
 * Nuxt Content (`@nuxtjs/mdc`) が内部で remark-mdc / remark-gfm / remark2rehype
 * を組み込むのに合わせて、unified 単独で同じ順序を再現した上で:
 *   - `:::message` / `:::details` が `containerComponent` に昇格
 *   - `@[youtube](...)` が `containerComponent(name=zenn-embed-you-tube)` に昇格
 *   - `$...$` が KaTeX HTML にレンダリングされる
 *   - 画像 `/images/...` が `/articles-images/...` に書き換えられる
 *   - 未対応記法 (`@[card]` / `:::warning`) が残っていればビルド fail
 *
 * 目的:
 *   - プラグイン順序の規約 (`remark-zenn-container` / `remark-zenn-embed` が
 *     remark-mdc の後ろ、`rehype-assert-no-zenn-leftovers` が rehype 末尾) が
 *     壊れた際に確実に fail するセーフティネット
 *   - Nuxt の generate まで走らせずに、パイプライン順序の回帰を高速に検知
 *     できる導線
 */

/**
 * 統合パイプラインを走らせ、最終 HAST を得るヘルパー。
 *
 * 順序は Step 14 で固めた設計:
 *   1. remarkParse  (md → mdast)
 *   2. remarkMdc    (MDC 記法の初期パース)
 *   3. remarkZennContainer (残った Zenn コンテナ記法を MDC ノード化)
 *   4. remarkZennEmbed     (Zenn 埋め込み記法を MDC ノード化)
 *   5. remarkZennImage     (/images/... → /articles-images/...)
 *   6. remarkMath   ($...$ を math ノードに)
 *   7. remarkRehype (mdast → hast)
 *   8. rehypeKatex  (math ノードを KaTeX HTML に)
 *   9. rehypeAssertNoZennLeftovers (未対応記法があれば throw)
 */
function runPipeline(md: string): HastRoot {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennContainer)
    .use(remarkZennEmbed)
    .use(remarkZennImage)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeAssertNoZennLeftovers)
  const mdast = processor.parse(md) as MdastRoot
  return processor.runSync(mdast) as HastRoot
}

/**
 * パイプラインを走らせて最終 HTML 文字列を得る。
 */
function runPipelineToHtml(md: string): string {
  return toHtml(runPipeline(md))
}

describe('zenn markdown pipeline (integration)', () => {
  describe('container + math coexistence', () => {
    it('renders :::message containing inline math', () => {
      const md = [':::message', 'Einstein: $E=mc^2$', ':::', ''].join('\n')
      const html = runPipelineToHtml(md)
      // containerComponent は hast 上では data.hName のタグに変換される
      expect(html).toContain(`<${ZENN_MESSAGE_TAG}`)
      expect(html).toContain('class="katex"')
    })

    it('renders :::details with block math inside', () => {
      const md = [
        ':::details Integral',
        '',
        '$$',
        '\\int_0^\\infty e^{-x^2} dx',
        '$$',
        '',
        ':::',
        '',
      ].join('\n')
      const html = runPipelineToHtml(md)
      expect(html).toContain(`<${ZENN_DETAILS_TAG}`)
      expect(html).toContain('class="katex-display"')
    })
  })

  describe('embeds and regular links coexist', () => {
    it('transforms @[youtube] while keeping plain links intact', () => {
      const md = [
        '[MDN](https://developer.mozilla.org/) is great.',
        '',
        '@[youtube](dQw4w9WgXcQ)',
        '',
      ].join('\n')
      const html = runPipelineToHtml(md)
      expect(html).toContain('<a href="https://developer.mozilla.org/"')
      expect(html).toContain(`<${ZENN_EMBED_YOUTUBE_TAG}`)
      expect(html).toContain('id="dQw4w9WgXcQ"')
    })
  })

  describe('image path rewrite stays effective', () => {
    it('rewrites /images/foo.png even with other Zenn syntax around', () => {
      const md = [
        ':::message',
        '![diagram](/images/diagram.png)',
        ':::',
        '',
      ].join('\n')
      const html = runPipelineToHtml(md)
      expect(html).toContain('/articles-images/diagram.png')
      expect(html).not.toContain('/images/diagram.png')
    })
  })

  describe('unsupported syntax still fails build', () => {
    it('throws when @[card] remains after Zenn embed pass', () => {
      const md = '@[card](https://example.com)\n'
      expect(() => runPipeline(md)).toThrow()
    })

    it('throws when :::warning container remains', () => {
      const md = [':::warning', 'body', ':::', ''].join('\n')
      expect(() => runPipeline(md)).toThrow()
    })
  })

  describe('combined document (golden-ish)', () => {
    it('handles a document with every supported feature', () => {
      const md = [
        '# Title',
        '',
        'Plain paragraph with [link](https://example.com) and $a+b$ inline math.',
        '',
        ':::message',
        '- item 1',
        '- item 2',
        ':::',
        '',
        ':::message alert',
        'Danger: see `$x$`.',
        ':::',
        '',
        ':::details More info',
        '',
        '$$',
        'x^2 + y^2 = 1',
        '$$',
        '',
        ':::',
        '',
        '@[youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
        '',
        '@[codepen](https://codepen.io/user/pen/abcDEF01)',
        '',
        '![diagram](/images/diagram.png)',
        '',
      ].join('\n')
      const html = runPipelineToHtml(md)
      expect(html).toContain(`<${ZENN_MESSAGE_TAG} type="info"`)
      expect(html).toContain(`<${ZENN_MESSAGE_TAG} type="alert"`)
      expect(html).toContain(`<${ZENN_DETAILS_TAG} title="More info"`)
      expect(html).toContain('class="katex"')
      expect(html).toContain('class="katex-display"')
      expect(html).toContain(`<${ZENN_EMBED_YOUTUBE_TAG}`)
      expect(html).toContain('/articles-images/diagram.png')
    })
  })
})
