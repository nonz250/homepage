/**
 * `utils/markdown/remarkZennMermaid.ts` のユニットテスト。
 *
 * テスト戦略:
 *   - remark-parse → remarkZennMermaid のパイプラインを通し、
 *     ` ```mermaid ... ``` ` が `containerComponent(name=zenn-mermaid)` に
 *     変換されることを検証
 *   - 他の言語コードフェンス (`js`, `typescript`) は素通しされ、`code` ノード
 *     のままであることを確認
 *   - 空 mermaid フェンス、複数 mermaid フェンス混在などのエッジケースも検証
 */
import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { Root, RootContent } from 'mdast'
import remarkZennMermaid from '../../../utils/markdown/remarkZennMermaid'
import { ZENN_MERMAID_TAG } from '../../../constants/zenn-mdc'

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
  const processor = unified().use(remarkParse).use(remarkZennMermaid)
  const parsed = processor.parse(input)
  return processor.runSync(parsed) as Root
}

describe('remarkZennMermaid', () => {
  it('converts ```mermaid fenced code into a zenn-mermaid containerComponent', () => {
    const md = ['```mermaid', 'graph TD', 'A --> B', '```', ''].join('\n')
    const tree = runPipeline(md)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].name).toBe(ZENN_MERMAID_TAG)
    expect(containers[0].attributes?.code).toBe('graph TD\nA --> B')
  })

  it('leaves other language code fences untouched', () => {
    const md = ['```js', 'const a = 1', '```', ''].join('\n')
    const tree = runPipeline(md)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
    // code ノードがそのまま残っていること
    const codeNodes = (tree.children as RootContent[]).filter(
      (node) => node.type === 'code',
    )
    expect(codeNodes).toHaveLength(1)
  })

  it('converts multiple mermaid fences in the same document', () => {
    const md = [
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      '',
      '```mermaid',
      'sequenceDiagram',
      'A->>B: hi',
      '```',
      '',
    ].join('\n')
    const tree = runPipeline(md)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(2)
    expect(containers[0].attributes?.code).toContain('graph TD')
    expect(containers[1].attributes?.code).toContain('sequenceDiagram')
  })

  it('converts an empty mermaid fence (keeps empty string in attribute)', () => {
    const md = ['```mermaid', '```', ''].join('\n')
    const tree = runPipeline(md)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].attributes?.code).toBe('')
  })

  it('does not convert indented code blocks (only fenced code with lang=mermaid)', () => {
    // 4-space indent code block は lang 情報を持たないため変換対象外。
    const md = ['    graph TD', '    A --> B', ''].join('\n')
    const tree = runPipeline(md)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(0)
  })

  it('leaves mermaid fence alongside other languages intact for non-mermaid', () => {
    const md = [
      '```javascript',
      'console.log(1)',
      '```',
      '',
      '```mermaid',
      'graph LR',
      '  a --> b',
      '```',
      '',
      '```typescript',
      'const x: number = 1',
      '```',
      '',
    ].join('\n')
    const tree = runPipeline(md)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].attributes?.code).toContain('graph LR')
    // 他の lang の code ノードは 2 個残る
    const codeNodes = (tree.children as RootContent[]).filter(
      (node) => node.type === 'code',
    )
    expect(codeNodes).toHaveLength(2)
  })

  it('preserves special characters in the DSL body', () => {
    // Mermaid では `"` や `<` が diagram label に普通に出現する。これらを
    // そのまま attribute に載せ、エスケープは後段 (MDC serializer) に任せる。
    const md = [
      '```mermaid',
      'graph TD',
      '  A["Hello <b>world</b>"] --> B',
      '```',
      '',
    ].join('\n')
    const tree = runPipeline(md)
    const containers = findAllContainers(tree)
    expect(containers).toHaveLength(1)
    expect(containers[0].attributes?.code).toContain('Hello <b>world</b>')
  })
})
