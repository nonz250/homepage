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
import remarkZennTweet from '../../../utils/markdown/remarkZennTweet'
import remarkZennGist from '../../../utils/markdown/remarkZennGist'
import remarkZennMermaid from '../../../utils/markdown/remarkZennMermaid'
import rehypeAssertNoZennLeftovers from '../../../utils/markdown/rehypeAssertNoZennLeftovers'
import {
  ZENN_DETAILS_TAG,
  ZENN_EMBED_GIST_TAG,
  ZENN_EMBED_TWEET_TAG,
  ZENN_EMBED_YOUTUBE_TAG,
  ZENN_MERMAID_TAG,
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
 * 順序は Phase 3 Batch C2 時点の設計:
 *   1. remarkParse  (md → mdast)
 *   2. remarkMdc    (MDC 記法の初期パース)
 *   3. remarkZennContainer (残った Zenn コンテナ記法を MDC ノード化)
 *   4. remarkZennEmbed     (Zenn 埋め込み記法を MDC ノード化)
 *   5. remarkZennTweet     (`@[tweet](url)` を <zenn-embed-tweet> に)
 *   6. remarkZennGist      (`@[gist](url)` を <zenn-embed-gist> に)
 *   7. remarkZennMermaid   (```mermaid コードフェンスを <zenn-mermaid> に)
 *   8. remarkZennImage     (/images/... → /articles-images/...)
 *   9. remarkMath   ($...$ を math ノードに)
 *  10. remarkRehype (mdast → hast)
 *  11. rehypeKatex  (math ノードを KaTeX HTML に)
 *  12. rehypeAssertNoZennLeftovers (未対応記法があれば throw)
 *
 * remark-zenn-card は本テストでは OGP fetch stub が必要になるため、統合
 * 専用テスト (`zennCardPipeline.test.ts`) に切り出している。本ファイルは
 * それ以外の Zenn 記法とパイプライン順序の回帰を担う。
 */
function runPipeline(md: string): HastRoot {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennContainer)
    .use(remarkZennEmbed)
    .use(remarkZennTweet)
    .use(remarkZennGist)
    .use(remarkZennMermaid)
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
    it('throws when @[tweet] has an invalid URL (e.g. wrong host)', () => {
      // Phase 3 Batch C2 で `@[tweet]` は対応済みだが、URL validator で
      // 不正 (ここでは host が `example.com`) と判定される場合は build fail する。
      const md = '@[tweet](https://example.com/status/1)\n'
      expect(() => runPipeline(md)).toThrow()
    })

    it('throws when @[gist] has an invalid id hash', () => {
      // 20 文字未満の hash は validator で拒否 → build fail。
      const md = '@[gist](https://gist.github.com/user/shortid)\n'
      expect(() => runPipeline(md)).toThrow()
    })

    it('throws when :::warning container remains', () => {
      const md = [':::warning', 'body', ':::', ''].join('\n')
      expect(() => runPipeline(md)).toThrow()
    })

    it('throws when @[mermaid] inline directive remains (inline form unsupported)', () => {
      // mermaid はコードフェンス ``` 形式のみサポートし、`@[mermaid]` inline
      // directive は意図的に未サポート。rehypeAssertNoZennLeftovers が span
      // 検知パターンで throw する契約を回帰で固定する。
      const md = '@[mermaid]\n'
      expect(() => runPipeline(md)).toThrow()
    })
  })

  describe('tweet and gist embeds render as MDC components', () => {
    it('transforms @[tweet](twitter URL) into a <zenn-embed-tweet> element', () => {
      const md = '@[tweet](https://twitter.com/user/status/1234567890123456789)\n'
      const html = runPipelineToHtml(md)
      expect(html).toContain(`<${ZENN_EMBED_TWEET_TAG}`)
      expect(html).toContain('id="1234567890123456789"')
    })

    it('transforms @[tweet](x.com URL) into a <zenn-embed-tweet> element', () => {
      const md = '@[tweet](https://x.com/user/status/42)\n'
      const html = runPipelineToHtml(md)
      expect(html).toContain(`<${ZENN_EMBED_TWEET_TAG}`)
      expect(html).toContain('id="42"')
    })

    it('transforms @[gist](URL) into a <zenn-embed-gist> element with user/id', () => {
      const md =
        '@[gist](https://gist.github.com/nonz250/abcdef1234567890abcdef1234567890)\n'
      const html = runPipelineToHtml(md)
      expect(html).toContain(`<${ZENN_EMBED_GIST_TAG}`)
      expect(html).toContain('user="nonz250"')
      expect(html).toContain('id="abcdef1234567890abcdef1234567890"')
    })
  })

  describe('mermaid code fence renders as <zenn-mermaid>', () => {
    it('converts ```mermaid into a <zenn-mermaid code="..."> element', () => {
      const md = ['```mermaid', 'graph TD', 'A --> B', '```', ''].join('\n')
      const html = runPipelineToHtml(md)
      expect(html).toContain(`<${ZENN_MERMAID_TAG}`)
      expect(html).toContain('code="graph TD')
    })

    it('leaves other language fences (js) unchanged while converting mermaid', () => {
      const md = [
        '```js',
        'const a = 1',
        '```',
        '',
        '```mermaid',
        'flowchart LR',
        'A --> B',
        '```',
        '',
      ].join('\n')
      const html = runPipelineToHtml(md)
      // js の code fence は pre/code element として残る
      expect(html).toContain('<pre')
      expect(html).toContain('language-js')
      // mermaid fence は MDC element に昇格
      expect(html).toContain(`<${ZENN_MERMAID_TAG}`)
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
