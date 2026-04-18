import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import type { Root } from 'mdast'
import remarkZennEmbed, {
  INVALID_ZENN_EMBED_ERROR_PREFIX,
} from '../../../utils/markdown/remarkZennEmbed'
import {
  ZENN_EMBED_CODEPEN_TAG,
  ZENN_EMBED_CODESANDBOX_TAG,
  ZENN_EMBED_STACKBLITZ_TAG,
  ZENN_EMBED_YOUTUBE_TAG,
} from '../../../constants/zenn-mdc'

/**
 * `remarkZennEmbed` の単体テスト。
 *
 * 本プラグインは paragraph 内の `@[service](url-or-id)` 記法 (Markdown では
 * text("@") + link(text=service, url=value) に分解される) を検知し、
 * URL/ID を正規化してバリデーションを通過したものだけ
 * `containerComponent(name=zenn-embed-*)` ノードに書き換える。
 *
 * テスト戦略:
 *   - remark-parse → remark-mdc → remarkZennEmbed を通し、mdast に
 *     期待する containerComponent が正しい `name`/`attributes.id` で
 *     現れることを検証
 *   - 無効な URL/ID はエラーメッセージ prefix 付きで throw されることを検証
 *   - code block / inline code 内の @[...] は link としてパースされないため、
 *     本プラグインの対象外となる (誤検知なし)
 */

/**
 * remark-parse → remark-mdc → remarkZennEmbed を通して mdast を得る。
 */
function runPipeline(input: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennEmbed)
  return processor.runSync(processor.parse(input)) as Root
}

/**
 * 再帰的に containerComponent ノードを全件取得する。
 */
interface ContainerShape {
  type: string
  name?: string
  attributes?: Record<string, string>
  children?: unknown[]
}

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

describe('remarkZennEmbed', () => {
  describe('YouTube normalization', () => {
    it('extracts video ID from a standard watch URL', () => {
      const tree = runPipeline('@[youtube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_EMBED_YOUTUBE_TAG)
      expect(containers[0].attributes).toMatchObject({ id: 'dQw4w9WgXcQ' })
    })

    it('extracts video ID from a youtu.be short URL', () => {
      const tree = runPipeline('@[youtube](https://youtu.be/dQw4w9WgXcQ)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].attributes).toMatchObject({ id: 'dQw4w9WgXcQ' })
    })

    it('accepts a raw 11-char video ID as-is', () => {
      const tree = runPipeline('@[youtube](dQw4w9WgXcQ)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].attributes).toMatchObject({ id: 'dQw4w9WgXcQ' })
    })

    it('throws when YouTube URL lacks a video ID', () => {
      expect(() =>
        runPipeline('@[youtube](https://www.youtube.com/)\n'),
      ).toThrowError(INVALID_ZENN_EMBED_ERROR_PREFIX)
    })

    it('throws when a raw ID is malformed (too short)', () => {
      expect(() =>
        runPipeline('@[youtube](short)\n'),
      ).toThrowError(INVALID_ZENN_EMBED_ERROR_PREFIX)
    })

    it('error message includes the original raw value', () => {
      // 10 文字の生 ID は 11 文字に満たず invalid。エラーメッセージに raw を
      // 含むことで執筆者がどの `@[youtube](...)` 記述を直すべきか特定できる。
      expect(() =>
        runPipeline('@[youtube](tooshortXX)\n'),
      ).toThrowError(/tooshortXX/)
    })
  })

  describe('CodePen normalization', () => {
    it('extracts path from a pen URL', () => {
      const tree = runPipeline('@[codepen](https://codepen.io/user/pen/abcDEF01)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_EMBED_CODEPEN_TAG)
      expect(containers[0].attributes).toMatchObject({ id: 'user/pen/abcDEF01' })
    })

    it('extracts path from an embed URL', () => {
      const tree = runPipeline('@[codepen](https://codepen.io/user/embed/abcDEF01)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].attributes).toMatchObject({ id: 'user/embed/abcDEF01' })
    })

    it('throws when CodePen path is malformed', () => {
      expect(() =>
        runPipeline('@[codepen](https://codepen.io/user/wrong/abcDEF01)\n'),
      ).toThrowError(INVALID_ZENN_EMBED_ERROR_PREFIX)
    })

    it('throws when CodePen URL has no path beyond origin', () => {
      expect(() =>
        runPipeline('@[codepen](https://codepen.io/)\n'),
      ).toThrowError(INVALID_ZENN_EMBED_ERROR_PREFIX)
    })
  })

  describe('CodeSandbox normalization', () => {
    it('extracts id from /s/<id> path URL', () => {
      const tree = runPipeline('@[codesandbox](https://codesandbox.io/s/new-sandbox-xyz)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_EMBED_CODESANDBOX_TAG)
      expect(containers[0].attributes).toMatchObject({ id: 'new-sandbox-xyz' })
    })

    it('accepts a raw sandbox id', () => {
      const tree = runPipeline('@[codesandbox](new-sandbox-xyz)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].attributes).toMatchObject({ id: 'new-sandbox-xyz' })
    })

    it('throws when id has invalid characters', () => {
      // `!` は `[A-Za-z0-9_-]` を満たさず validator で invalid 扱いになる。
      // スペースを含むと Markdown の link 記法が成立せず plain text のまま
      // 残るため、パターンに合致しつつ文字種で落ちる例として `!` のみ含む id
      // を使う。
      expect(() =>
        runPipeline('@[codesandbox](bad-id!)\n'),
      ).toThrowError(INVALID_ZENN_EMBED_ERROR_PREFIX)
    })

    it('throws when sandbox path is empty after /s/', () => {
      expect(() =>
        runPipeline('@[codesandbox](https://codesandbox.io/s/)\n'),
      ).toThrowError(INVALID_ZENN_EMBED_ERROR_PREFIX)
    })
  })

  describe('StackBlitz normalization', () => {
    it('extracts edit path', () => {
      const tree = runPipeline('@[stackblitz](https://stackblitz.com/edit/my-app)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_EMBED_STACKBLITZ_TAG)
      expect(containers[0].attributes).toMatchObject({ id: 'edit/my-app' })
    })

    it('extracts github path', () => {
      const tree = runPipeline('@[stackblitz](https://stackblitz.com/github/user/repo)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].attributes).toMatchObject({ id: 'github/user/repo' })
    })

    it('throws on unsupported path type', () => {
      expect(() =>
        runPipeline('@[stackblitz](https://stackblitz.com/projects/abc)\n'),
      ).toThrowError(INVALID_ZENN_EMBED_ERROR_PREFIX)
    })

    it('accepts already-normalized id (edit/...)', () => {
      const tree = runPipeline('@[stackblitz](edit/my-app)\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].attributes).toMatchObject({ id: 'edit/my-app' })
    })
  })

  describe('mixed document', () => {
    it('converts only Zenn embed links, keeping other links intact', () => {
      const input = [
        'See [MDN](https://developer.mozilla.org/) for docs.',
        '',
        '@[youtube](dQw4w9WgXcQ)',
        '',
      ].join('\n')
      const tree = runPipeline(input)
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(1)
      expect(containers[0].name).toBe(ZENN_EMBED_YOUTUBE_TAG)
    })

    it('keeps plain `@` text when not followed by a Zenn service link', () => {
      const tree = runPipeline('Contact user@example.com for details.\n')
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(0)
    })

    it('converts multiple embeds in the same document', () => {
      const input = [
        '@[youtube](dQw4w9WgXcQ)',
        '',
        '@[codepen](https://codepen.io/user/pen/abcDEF01)',
        '',
      ].join('\n')
      const tree = runPipeline(input)
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(2)
    })
  })

  describe('code blocks are not touched', () => {
    it('does not convert `@[youtube]` inside fenced code', () => {
      const input = [
        '```markdown',
        '@[youtube](dQw4w9WgXcQ)',
        '```',
        '',
      ].join('\n')
      const tree = runPipeline(input)
      const containers = findAllContainers(tree)
      expect(containers).toHaveLength(0)
    })
  })
})
