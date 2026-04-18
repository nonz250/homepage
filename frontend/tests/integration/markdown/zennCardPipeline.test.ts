/**
 * `@[card](url)` を含む markdown を remark pipeline に通したときの統合テスト。
 *
 * 目的:
 *   - `NO_NETWORK_FETCH=1` 相当の fetchOgp stub (常に OgpFailure) を注入した
 *     状態で、パイプライン全体が throw せず fallback card を描画できることを
 *     確認する
 *   - 成功時 (fetchOgp が record を返す場合) に `<zenn-embed-card>` 要素に
 *     正しく props (title / url / host) が載ることを確認する
 *
 * 本テストは `buildFetchOgp` 自体は呼ばず、remarkZennCard に直接 stub を
 * 渡す形で pipeline を組む。これにより本番 nuxt.config.ts の経路と
 * `NO_NETWORK_FETCH` 分岐を機能的に再現する。
 */
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
import remarkZennCard from '../../../utils/markdown/remarkZennCard'
import type {
  FetchOgpFn,
  RemarkZennCardDeps,
} from '../../../utils/markdown/remarkZennCard'
import rehypeAssertNoZennLeftovers from '../../../utils/markdown/rehypeAssertNoZennLeftovers'
import type { OgpFailure } from '../../../utils/ogp/fetchOgp'
import type { OgpRecord } from '../../../utils/ogp/ogpCache'
import { ZENN_EMBED_CARD_TAG } from '../../../constants/zenn-mdc'

/**
 * `NO_NETWORK_FETCH=1` 相当の常時 failure 返す stub。
 */
const FAILURE_FETCH_OGP: FetchOgpFn = async (url) => {
  const failure: OgpFailure = {
    ok: false,
    url,
    reason: 'no_network_fetch',
  }
  return failure
}

/**
 * 成功値を返す stub。任意の OgpRecord を渡せる。
 */
function makeSuccessFetchOgp(record: OgpRecord): FetchOgpFn {
  return async () => record
}

async function runPipelineToHtml(
  md: string,
  deps: RemarkZennCardDeps,
): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennContainer)
    .use(remarkZennEmbed)
    .use(remarkZennCard, deps)
    .use(remarkZennImage)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeAssertNoZennLeftovers)
  const mdast = processor.parse(md) as MdastRoot
  const hast = (await processor.run(mdast)) as HastRoot
  return toHtml(hast)
}

describe('remark-zenn-card pipeline integration', () => {
  it('renders fallback card (hostname as title) when fetchOgp returns failure', async () => {
    const md = '@[card](https://example.com/article)\n'
    const html = await runPipelineToHtml(md, {
      fetchOgp: FAILURE_FETCH_OGP,
    })
    expect(html).toContain(`<${ZENN_EMBED_CARD_TAG}`)
    // fallback では title=hostname / url=元 URL が attribute として載る。
    expect(html).toContain('title="example.com"')
    expect(html).toContain('url="https://example.com/article"')
    // image-path / site-name は空文字で載る。
    expect(html).toContain('image-path=""')
    expect(html).toContain('site-name=""')
  })

  it('renders full card when fetchOgp returns a record', async () => {
    const record: OgpRecord = {
      url: 'https://example.com/article',
      title: 'Example article',
      description: 'A sample article for testing',
      imagePath: '/ogp-images/abc.png',
      siteName: 'Example',
      fetchedAt: '2026-01-01T00:00:00.000Z',
    }
    const md = '@[card](https://example.com/article)\n'
    const html = await runPipelineToHtml(md, {
      fetchOgp: makeSuccessFetchOgp(record),
    })
    expect(html).toContain('title="Example article"')
    expect(html).toContain('description="A sample article for testing"')
    expect(html).toContain('image-path="/ogp-images/abc.png"')
    expect(html).toContain('site-name="Example"')
  })

  it('keeps non-card Zenn features intact alongside @[card]', async () => {
    const md = [
      ':::message',
      '[link](https://example.com/)',
      ':::',
      '',
      '@[card](https://example.com/card)',
      '',
      '@[youtube](dQw4w9WgXcQ)',
      '',
    ].join('\n')
    const html = await runPipelineToHtml(md, {
      fetchOgp: FAILURE_FETCH_OGP,
    })
    expect(html).toContain('<zenn-message')
    expect(html).toContain('<zenn-embed-you-tube')
    expect(html).toContain(`<${ZENN_EMBED_CARD_TAG}`)
  })
})
