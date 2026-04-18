import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import type { Root } from 'mdast'
import remarkZennContainer from '../../../utils/markdown/remarkZennContainer'
import {
  ZENN_DETAILS_TAG,
  ZENN_MESSAGE_TAG,
} from '../../../constants/zenn-mdc'

/**
 * `remarkZennContainer` の単体テスト。
 *
 * 本プラグインは remark-mdc が生成した `containerComponent` ノードの Zenn
 * 由来の name (`message` / `details`) を、MDC コンポーネント側で期待される
 * タグ名 (`zenn-message` / `zenn-details`) に書き換え、さらに引数付きの
 * `:::message alert\n...\n:::` などの paragraph 残留を `containerComponent`
 * に昇格させる責務を持つ。
 *
 * テスト戦略:
 *   - remark-parse → remark-mdc → remarkZennContainer を順に通し、
 *     最終 mdast に containerComponent が期待タグ名で存在するか検証する
 *   - stringify は containerComponent を表現できないため使わない
 *   - Fenced code block 内の `:::message` 等は remark-mdc 段階で code として
 *     扱われるため、本プラグインの対象外 (= 書き換えないこと) を確認する
 */

/**
 * remark-parse → remark-mdc → remarkZennContainer を通して mdast を得る。
 */
function runPipeline(input: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennContainer)
  return processor.runSync(processor.parse(input)) as Root
}

/**
 * ルート直下の `containerComponent` ノードのみを取り出すヘルパー。
 */
interface ContainerShape {
  type: string
  name?: string
  attributes?: Record<string, string>
  children?: unknown[]
}

function findContainers(tree: Root): ContainerShape[] {
  const result: ContainerShape[] = []
  for (const child of tree.children as ContainerShape[]) {
    if (child.type === 'containerComponent') {
      result.push(child)
    }
  }
  return result
}

/**
 * containerComponent を再帰で全件取得する (ネストも含む)。
 */
function findAllContainers(tree: Root): ContainerShape[] {
  const result: ContainerShape[] = []
  const visit = (node: { children?: unknown[]; type?: string } & Record<string, unknown>): void => {
    const container = node as ContainerShape
    if (container.type === 'containerComponent') {
      result.push(container)
    }
    const children = container.children
    if (Array.isArray(children)) {
      for (const child of children) {
        visit(child as never)
      }
    }
  }
  visit(tree as never)
  return result
}

describe('remarkZennContainer', () => {
  describe('lifted containers (no arguments)', () => {
    it('renames `:::message` to `zenn-message` with default type=info', () => {
      const input = [':::message', 'Hello', ':::', ''].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_MESSAGE_TAG)
      expect(containers[0].attributes).toMatchObject({ type: 'info' })
    })

    it('renames `:::details` to `zenn-details` with default empty title', () => {
      const input = [':::details', 'Body', ':::', ''].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_DETAILS_TAG)
      expect(containers[0].attributes).toMatchObject({ title: '' })
    })
  })

  describe('argumented containers (needs lifting)', () => {
    it('lifts `:::message alert` into a containerComponent', () => {
      const input = [':::message alert', 'Caution', ':::', ''].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_MESSAGE_TAG)
      expect(containers[0].attributes).toMatchObject({ type: 'alert' })
    })

    it('lifts `:::details Click here` into a containerComponent with title', () => {
      const input = [':::details Click here', 'Body', ':::', ''].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_DETAILS_TAG)
      expect(containers[0].attributes).toMatchObject({ title: 'Click here' })
    })

    it('preserves Japanese title with spaces', () => {
      const input = [':::details 詳しくはこちら', '本文', ':::', ''].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].attributes).toMatchObject({ title: '詳しくはこちら' })
    })
  })

  describe('multi-paragraph containers', () => {
    it('collects children between opener and closer into a container', () => {
      const input = [
        ':::message alert',
        'first para',
        '',
        'second para',
        ':::',
        '',
      ].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].children?.length).toBeGreaterThanOrEqual(2)
    })

    it('does not lift when closer is missing', () => {
      // 閉じ忘れの場合は変換しない (後段の rehypeAssertNoZennLeftovers が検知)
      const input = [':::message alert', 'orphan content', ''].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(0)
    })
  })

  describe('nested containers', () => {
    it('handles nested :::details inside :::message', () => {
      const input = [
        ':::message',
        'outer intro',
        '',
        ':::details inner',
        'deep',
        ':::',
        '',
        'outer tail',
        ':::',
        '',
      ].join('\n')
      const tree = runPipeline(input)
      const all = findAllContainers(tree)
      const messageNodes = all.filter((c) => c.name === ZENN_MESSAGE_TAG)
      const detailsNodes = all.filter((c) => c.name === ZENN_DETAILS_TAG)
      expect(messageNodes).toHaveLength(1)
      expect(detailsNodes).toHaveLength(1)
    })
  })

  describe('code blocks are not touched', () => {
    it('does not lift `:::message` inside a fenced code block', () => {
      const input = [
        'example:',
        '',
        '```markdown',
        ':::message',
        'not a real container',
        ':::',
        '```',
        '',
      ].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(0)
    })

    it('does not lift `:::message` inside inline code', () => {
      const input = 'write `:::message` to highlight\n'
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(0)
    })
  })

  describe('pass-through', () => {
    it('leaves plain prose untouched', () => {
      const input = ['# Title', '', 'plain body', ''].join('\n')
      const tree = runPipeline(input)
      const containers = findContainers(tree)
      expect(containers).toHaveLength(0)
    })
  })
})
