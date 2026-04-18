/**
 * `utils/markdown/remarkZennTweet.ts` のユニットテスト。
 *
 * テスト戦略:
 *   - remark-parse → remark-mdc → remarkZennTweet のパイプラインを通し、
 *     `@[tweet](URL)` が `containerComponent(name=zenn-embed-tweet)` に
 *     変換されることを検証する
 *   - 不正な URL (javascript: / 素の ID のみ / host 不一致) は throw
 *   - 他の link / 他の `@[service](url)` には影響しない
 */
import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import type { Root } from 'mdast'
import remarkZennTweet, {
  INVALID_ZENN_TWEET_ERROR_PREFIX,
} from '../../../utils/markdown/remarkZennTweet'
import { ZENN_EMBED_TWEET_TAG } from '../../../constants/zenn-mdc'

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

function runPipeline(input: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennTweet)
  const parsed = processor.parse(input)
  return processor.runSync(parsed) as Root
}

describe('remarkZennTweet', () => {
  it('converts @[tweet](twitter.com URL) into zenn-embed-tweet containerComponent', () => {
    const tree = runPipeline(
      '@[tweet](https://twitter.com/user/status/1234567890123456789)\n',
    )
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].name).toBe(ZENN_EMBED_TWEET_TAG)
    expect(containers[0].attributes).toMatchObject({
      id: '1234567890123456789',
      url: 'https://twitter.com/user/status/1234567890123456789',
    })
  })

  it('converts @[tweet](x.com URL) to the same tag', () => {
    const tree = runPipeline(
      '@[tweet](https://x.com/user/status/987654321)\n',
    )
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].attributes?.id).toBe('987654321')
  })

  it('throws on invalid host', () => {
    expect(() =>
      runPipeline('@[tweet](https://evil.example.com/status/1234567890)\n'),
    ).toThrowError(INVALID_ZENN_TWEET_ERROR_PREFIX)
  })

  it('throws on raw ID (no URL)', () => {
    expect(() => runPipeline('@[tweet](1234567890)\n')).toThrowError(
      INVALID_ZENN_TWEET_ERROR_PREFIX,
    )
  })

  it('throws on javascript: scheme', () => {
    expect(() =>
      // eslint-disable-next-line no-script-url
      runPipeline('@[tweet](javascript:alert(1))\n'),
    ).toThrowError(INVALID_ZENN_TWEET_ERROR_PREFIX)
  })

  it('throws on ID exceeding 25 digits', () => {
    const overflow = '1'.repeat(26)
    expect(() =>
      runPipeline(`@[tweet](https://twitter.com/u/status/${overflow})\n`),
    ).toThrowError(INVALID_ZENN_TWEET_ERROR_PREFIX)
  })

  it('converts multiple tweets in the same document', () => {
    const input = [
      '@[tweet](https://twitter.com/a/status/1)',
      '',
      '@[tweet](https://x.com/b/status/2)',
      '',
    ].join('\n')
    const tree = runPipeline(input)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(2)
    expect(containers[0].attributes?.id).toBe('1')
    expect(containers[1].attributes?.id).toBe('2')
  })

  it('does not convert @[youtube] or other embeds', () => {
    const tree = runPipeline(
      '@[youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n',
    )
    const containers = findAllContainers(tree)
    // tweet ではないので 0 件。
    expect(containers).toHaveLength(0)
  })

  it('does not touch plain [tweet](url) without @', () => {
    const tree = runPipeline(
      'See [tweet](https://twitter.com/user/status/1) please.\n',
    )
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })

  it('does not convert @[tweet] inside fenced code block', () => {
    const input = [
      '```markdown',
      '@[tweet](https://twitter.com/user/status/1234567890)',
      '```',
      '',
    ].join('\n')
    const tree = runPipeline(input)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })

  it('keeps other paragraphs intact when mixed with tweet', () => {
    const input = [
      'intro text',
      '',
      '@[tweet](https://twitter.com/user/status/9876543210)',
      '',
      'outro text',
      '',
    ].join('\n')
    const tree = runPipeline(input)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    const rootChildren = tree.children
    expect(rootChildren.some((c) => c.type === 'paragraph')).toBe(true)
  })
})
