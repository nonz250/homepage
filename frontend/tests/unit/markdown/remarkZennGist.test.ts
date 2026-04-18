/**
 * `utils/markdown/remarkZennGist.ts` のユニットテスト。
 *
 * テスト戦略:
 *   - remark-parse → remark-mdc → remarkZennGist のパイプラインを通し、
 *     `@[gist](URL)` が `containerComponent(name=zenn-embed-gist)` に
 *     変換されることを検証する
 *   - 不正な URL (javascript: / host 違反 / 素のパスのみ / 無効な hash) は
 *     throw して build fail させる
 *   - 他の link / 他の `@[service](url)` には影響しない
 */
import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import type { Root } from 'mdast'
import remarkZennGist, {
  INVALID_ZENN_GIST_ERROR_PREFIX,
} from '../../../utils/markdown/remarkZennGist'
import { ZENN_EMBED_GIST_TAG } from '../../../constants/zenn-mdc'

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
    .use(remarkZennGist)
  const parsed = processor.parse(input)
  return processor.runSync(parsed) as Root
}

describe('remarkZennGist', () => {
  it('converts @[gist](canonical URL) into zenn-embed-gist containerComponent', () => {
    const tree = runPipeline(
      '@[gist](https://gist.github.com/nonz250/abcdef1234567890abcdef1234567890)\n',
    )
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].name).toBe(ZENN_EMBED_GIST_TAG)
    expect(containers[0].attributes).toMatchObject({
      user: 'nonz250',
      id: 'abcdef1234567890abcdef1234567890',
      url: 'https://gist.github.com/nonz250/abcdef1234567890abcdef1234567890',
    })
  })

  it('throws on invalid host', () => {
    expect(() =>
      runPipeline(
        '@[gist](https://evil.example.com/user/abcdef1234567890abcd)\n',
      ),
    ).toThrowError(INVALID_ZENN_GIST_ERROR_PREFIX)
  })

  it('throws on raw path (no URL)', () => {
    expect(() =>
      runPipeline('@[gist](user/abcdef1234567890abcd)\n'),
    ).toThrowError(INVALID_ZENN_GIST_ERROR_PREFIX)
  })

  it('throws on javascript: scheme', () => {
    expect(() =>
      // eslint-disable-next-line no-script-url
      runPipeline('@[gist](javascript:alert(1))\n'),
    ).toThrowError(INVALID_ZENN_GIST_ERROR_PREFIX)
  })

  it('throws on invalid user (leading hyphen)', () => {
    expect(() =>
      runPipeline(
        '@[gist](https://gist.github.com/-user/abcdef1234567890abcd)\n',
      ),
    ).toThrowError(INVALID_ZENN_GIST_ERROR_PREFIX)
  })

  it('throws on id with uppercase hex (GitHub uses lowercase)', () => {
    expect(() =>
      runPipeline(
        '@[gist](https://gist.github.com/user/ABCDEF1234567890ABCD)\n',
      ),
    ).toThrowError(INVALID_ZENN_GIST_ERROR_PREFIX)
  })

  it('throws on id that is too short', () => {
    expect(() =>
      runPipeline('@[gist](https://gist.github.com/user/abcdef12345)\n'),
    ).toThrowError(INVALID_ZENN_GIST_ERROR_PREFIX)
  })

  it('converts multiple gists in the same document', () => {
    const input = [
      '@[gist](https://gist.github.com/u1/abcdef1234567890abcd)',
      '',
      '@[gist](https://gist.github.com/u2/1234567890abcdef1234)',
      '',
    ].join('\n')
    const tree = runPipeline(input)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(2)
    expect(containers[0].attributes?.user).toBe('u1')
    expect(containers[1].attributes?.user).toBe('u2')
  })

  it('does not convert @[youtube] or other embeds', () => {
    const tree = runPipeline(
      '@[youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n',
    )
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })

  it('does not touch plain [gist](url) without @', () => {
    const tree = runPipeline(
      'See [gist](https://gist.github.com/u/abcdef1234567890abcd) please.\n',
    )
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })

  it('does not convert @[gist] inside fenced code block', () => {
    const input = [
      '```markdown',
      '@[gist](https://gist.github.com/u/abcdef1234567890abcd)',
      '```',
      '',
    ].join('\n')
    const tree = runPipeline(input)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })

  it('keeps other paragraphs intact when mixed with gist', () => {
    const input = [
      'intro',
      '',
      '@[gist](https://gist.github.com/u/abcdef1234567890abcd)',
      '',
      'outro',
      '',
    ].join('\n')
    const tree = runPipeline(input)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    const rootChildren = tree.children
    expect(rootChildren.some((c) => c.type === 'paragraph')).toBe(true)
  })
})
