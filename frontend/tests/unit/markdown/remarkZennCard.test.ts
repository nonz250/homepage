/**
 * `utils/markdown/remarkZennCard.ts` のユニットテスト。
 *
 * テスト戦略:
 *   - remark-parse → remark-mdc → remarkZennCard (fake fetchOgp 注入) の
 *     パイプラインを通し、`@[card](URL)` が `containerComponent
 *     (name=zenn-embed-card)` に変換されることを検証
 *   - fetchOgp が success / failure 両方のケースで正しく attributes が詰まる
 *   - 無効な URL (javascript: / 空文字) は throw
 *   - 他の link / `@[youtube](...)` 等には影響しない
 *
 * fetchOgp は一切ネットワークを叩かない fake を注入するため、テストは
 * 完全にオフラインで実行できる。
 */
import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import type { Root } from 'mdast'
import remarkZennCard, {
  INVALID_ZENN_CARD_ERROR_PREFIX,
} from '../../../utils/markdown/remarkZennCard'
import type {
  FetchOgpFn,
  RemarkZennCardDeps,
} from '../../../utils/markdown/remarkZennCard'
import type { OgpRecord } from '../../../utils/ogp/ogpCache'
import type { OgpFailure } from '../../../utils/ogp/fetchOgp'
import { ZENN_EMBED_CARD_TAG } from '../../../constants/zenn-mdc'

interface ContainerShape {
  type: string
  name?: string
  attributes?: Record<string, string>
  children?: unknown[]
}

/**
 * 再帰的に containerComponent ノードを全件取得する。
 */
function findAllContainers(tree: Root): ContainerShape[] {
  const result: ContainerShape[] = []
  const visit = (node: unknown): void => {
    const container = node as ContainerShape
    if (container?.type === 'containerComponent') {
      result.push(container)
    }
    const children = container?.children
    if (Array.isArray(children)) {
      for (const child of children) {
        visit(child)
      }
    }
  }
  visit(tree)
  return result
}

async function runPipeline(
  input: string,
  deps: RemarkZennCardDeps,
): Promise<Root> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennCard, deps)
  const parsed = processor.parse(input)
  const transformed = await processor.run(parsed)
  return transformed as Root
}

/** 常に OgpRecord (success) を返す fake fetchOgp を作る。 */
function makeSuccessFetchOgp(record: OgpRecord): FetchOgpFn {
  return async () => record
}

/** 常に OgpFailure を返す fake fetchOgp を作る。 */
function makeFailureFetchOgp(reason = 'test_failure'): FetchOgpFn {
  return async (url) => ({ ok: false, url, reason } satisfies OgpFailure)
}

const SUCCESS_RECORD: OgpRecord = {
  url: 'https://example.com/article',
  title: 'Example article',
  description: 'A sample article for testing',
  imagePath: '/ogp-images/abc.png',
  siteName: 'Example',
  fetchedAt: '2026-01-01T00:00:00.000Z',
}

describe('remarkZennCard', () => {
  it('converts @[card](url) into a zenn-embed-card containerComponent on success', async () => {
    const tree = await runPipeline('@[card](https://example.com/article)\n', {
      fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD),
    })
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].name).toBe(ZENN_EMBED_CARD_TAG)
    expect(containers[0].attributes).toMatchObject({
      title: 'Example article',
      description: 'A sample article for testing',
      url: 'https://example.com/article',
      'image-path': '/ogp-images/abc.png',
      'site-name': 'Example',
    })
  })

  it('uses fallback attributes (hostname as title) when fetchOgp returns failure', async () => {
    const tree = await runPipeline(
      '@[card](https://unreachable.example.com/x)\n',
      { fetchOgp: makeFailureFetchOgp('fetch_failed:ECONNREFUSED') },
    )
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].attributes?.title).toBe('unreachable.example.com')
    expect(containers[0].attributes?.url).toBe(
      'https://unreachable.example.com/x',
    )
    expect(containers[0].attributes?.['image-path']).toBe('')
    expect(containers[0].attributes?.['site-name']).toBe('')
  })

  it('throws on invalid URL (javascript:)', async () => {
    await expect(
      runPipeline(
        // eslint-disable-next-line no-script-url
        '@[card](javascript:alert(1))\n',
        { fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD) },
      ),
    ).rejects.toThrowError(INVALID_ZENN_CARD_ERROR_PREFIX)
  })

  it('throws on invalid URL (file:)', async () => {
    await expect(
      runPipeline('@[card](file:///etc/passwd)\n', {
        fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD),
      }),
    ).rejects.toThrowError(INVALID_ZENN_CARD_ERROR_PREFIX)
  })

  it('converts multiple cards in the same document', async () => {
    const input = [
      '@[card](https://example.com/a)',
      '',
      '@[card](https://example.com/b)',
      '',
    ].join('\n')
    const tree = await runPipeline(input, {
      fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD),
    })
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(2)
  })

  it('does not convert other @[service](url) embeds', async () => {
    const tree = await runPipeline(
      '@[youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n',
      { fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD) },
    )
    const containers = findAllContainers(tree)
    // card 記法でないため 0 件 (youtube はこのプラグインの対象外)。
    expect(containers).toHaveLength(0)
  })

  it('does not touch plain links without the @ prefix', async () => {
    const tree = await runPipeline('See [card](https://example.com/) docs.\n', {
      fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD),
    })
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })

  it('keeps non-card paragraphs intact', async () => {
    const input = [
      'intro text',
      '',
      '@[card](https://example.com/a)',
      '',
      'outro text',
      '',
    ].join('\n')
    const tree = await runPipeline(input, {
      fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD),
    })
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    // intro/outro も残っていること (paragraph として残る)。
    const rootChildren = tree.children
    expect(rootChildren.some((c) => c.type === 'paragraph')).toBe(true)
  })

  it('does not convert @[card] inside fenced code', async () => {
    const input = [
      '```markdown',
      '@[card](https://example.com/)',
      '```',
      '',
    ].join('\n')
    const tree = await runPipeline(input, {
      fetchOgp: makeSuccessFetchOgp(SUCCESS_RECORD),
    })
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })
})
