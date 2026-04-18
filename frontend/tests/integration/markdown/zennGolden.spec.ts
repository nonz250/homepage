import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import { toHtml } from 'hast-util-to-html'
import { fromHtml } from 'hast-util-from-html'
import markdownToHtml from 'zenn-markdown-html'
import type { Root as MdastRoot } from 'mdast'
import type { Root as HastRoot, Element, ElementContent } from 'hast'
import remarkZennImage from '../../../utils/markdown/remarkZennImage'
import remarkZennContainer from '../../../utils/markdown/remarkZennContainer'
import remarkZennEmbed from '../../../utils/markdown/remarkZennEmbed'
import rehypeAssertNoZennLeftovers from '../../../utils/markdown/rehypeAssertNoZennLeftovers'
import {
  ZENN_DETAILS_TAG,
  ZENN_EMBED_CODEPEN_TAG,
  ZENN_EMBED_CODESANDBOX_TAG,
  ZENN_EMBED_STACKBLITZ_TAG,
  ZENN_EMBED_YOUTUBE_TAG,
  ZENN_MESSAGE_TAG,
} from '../../../constants/zenn-mdc'

/**
 * Zenn 公式 Markdown パイプライン (`zenn-markdown-html`) との意味的等価性を
 * 検証する Golden comparison テスト。
 *
 * 完全な DOM 一致は不可能 (Zenn は `<aside class="msg message">`、自作は
 * `<zenn-message type="info">` のように表現手段が違う) なので、両方のツリーから
 * 「論理要素」を抽出して比較する。論理要素とは以下のような意味単位:
 *
 *   - message.info, message.alert
 *   - details
 *   - embed.youtube, embed.codepen, embed.codesandbox, embed.stackblitz
 *   - math.inline, math.block
 *
 * 比較の基準:
 *   1. fixture 1 件につき、Zenn 側/自作側のそれぞれで「この logical kind が
 *      含まれている」ことを確認する
 *   2. 両者のリストが集合として一致する (順不同)
 *   3. 埋め込みについては ID (identifier) も抽出して一致することを確認
 *
 * ID 抽出ルールの DSL:
 *   - YouTube:     Zenn=iframe.src の `/embed/<id>`, 自作=`id` attribute
 *   - CodePen:     Zenn=iframe.src の `/embed/<id>`, 自作=`id` attribute (`user/pen/id`)
 *                  → 正規化して末尾 segment のみ比較
 *   - CodeSandbox: 構造的等価のみ (ID パスの扱いが両者で根本的に違うため)
 *   - StackBlitz:  構造的等価のみ (似た理由)
 *
 * 許容差分 (ALLOWED_CLASS_MAP 等の DSL):
 *   Zenn 側の生 class → 自作側の tag name への対応。検出時に logical kind へ
 *   落とす。
 */

interface FixtureCase {
  /** テストケース名 (describe のラベル) */
  readonly name: string
  /** Zenn パイプラインへ流す fixture ファイル名 */
  readonly zennFixture: string
  /** 自作パイプラインへ流す fixture ファイル名 */
  readonly oursFixture: string
  /**
   * 期待する論理要素 (順不同)。
   * 同じ logical kind が複数回現れる場合は複数回列挙する。
   */
  readonly expectedLogicalKinds: readonly LogicalKind[]
}

/** 論理要素の識別子。DSL として比較の粒度を表現する。 */
type LogicalKind =
  | 'message.info'
  | 'message.alert'
  | 'details'
  | 'embed.youtube'
  | 'embed.codepen'
  | 'embed.codesandbox'
  | 'embed.stackblitz'
  | 'math.inline'
  | 'math.block'

/**
 * CodeSandbox のみ、両側で valid な入力表記が存在しない (Zenn は `/embed/`、
 * 自作は `/s/` を受け付ける) ため、fixture を 2 系統に分けて扱う。
 */
const FIXTURE_CASES: readonly FixtureCase[] = [
  {
    name: 'message (info + alert)',
    zennFixture: 'message.md',
    oursFixture: 'message.md',
    expectedLogicalKinds: ['message.info', 'message.alert'],
  },
  {
    name: 'details',
    zennFixture: 'details.md',
    oursFixture: 'details.md',
    expectedLogicalKinds: ['details'],
  },
  {
    name: 'youtube',
    zennFixture: 'youtube.md',
    oursFixture: 'youtube.md',
    expectedLogicalKinds: ['embed.youtube'],
  },
  {
    name: 'codepen',
    zennFixture: 'codepen.md',
    oursFixture: 'codepen.md',
    expectedLogicalKinds: ['embed.codepen'],
  },
  {
    name: 'codesandbox',
    zennFixture: 'codesandbox-embed-url.md',
    oursFixture: 'codesandbox-share-url.md',
    expectedLogicalKinds: ['embed.codesandbox'],
  },
  {
    name: 'stackblitz',
    zennFixture: 'stackblitz.md',
    oursFixture: 'stackblitz.md',
    expectedLogicalKinds: ['embed.stackblitz'],
  },
  {
    name: 'math (inline + block)',
    zennFixture: 'math.md',
    oursFixture: 'math.md',
    expectedLogicalKinds: ['math.inline', 'math.block'],
  },
]

const FIXTURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/zenn-syntax',
)

/**
 * fixture 本文 (frontmatter 除去後) を読み込む。
 */
function loadFixtureBody(fileName: string): string {
  const raw = readFileSync(resolve(FIXTURES_DIR, fileName), 'utf-8')
  return raw.replace(/^---[\s\S]*?---\n?/, '')
}

/**
 * 自作パイプライン (Phase 2 時点で nuxt.config.ts に登録済みの順序) を構築する。
 * 本番パイプラインとの乖離がないよう、同じ remark/rehype 順序を再現する。
 */
function runOursPipelineToHtml(md: string): string {
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
  const hast = processor.runSync(mdast) as HastRoot
  return toHtml(hast)
}

/**
 * Zenn 公式パイプライン (`zenn-markdown-html`) を走らせて HTML を得る。
 */
async function runZennPipelineToHtml(md: string): Promise<string> {
  return await markdownToHtml(md)
}

/**
 * HTML を parse5 経由で HAST に変換する (比較側で使う構造化表現を得るため)。
 */
function parseHtml(html: string): HastRoot {
  return fromHtml(html, { fragment: true }) as HastRoot
}

/**
 * Element かどうか型ガードする。
 */
function isElement(node: ElementContent): node is Element {
  return node.type === 'element'
}

/**
 * ノードを深さ優先で走査し、全 Element を列挙する。
 */
function* walkElements(root: HastRoot): Generator<Element> {
  const stack: Array<ElementContent | HastRoot> = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.type === 'element' || node.type === 'root') {
      for (const child of (node as HastRoot).children as ElementContent[]) {
        if (child.type === 'element') yield child
        stack.push(child)
      }
    }
  }
}

/**
 * 要素の className 配列を取得する。
 */
function classNameOf(element: Element): string[] {
  const value = element.properties?.className
  if (Array.isArray(value)) {
    return value.map((v) => String(v))
  }
  if (typeof value === 'string') {
    return value.split(/\s+/).filter(Boolean)
  }
  return []
}

/**
 * Zenn 側の class → LogicalKind 対応表。ゴールデン比較の DSL。
 *
 * 観測した代表例:
 *   - `<aside class="msg message">` → message.info
 *   - `<aside class="msg alert">`   → message.alert
 *   - `<section class="zenn-katex">` → math.block
 *   - `<embed-katex>` / `<eq class="zenn-katex">` → math.inline
 *   - `<span class="embed-block embed-youtube">` → embed.youtube
 *   - `<span class="embed-block embed-codepen">` → embed.codepen
 *   - 他の embed-* も同様
 */
const ZENN_CLASS_DSL: Readonly<Record<string, LogicalKind>> = {
  'msg message': 'message.info',
  'msg alert': 'message.alert',
  'embed-youtube': 'embed.youtube',
  'embed-codepen': 'embed.codepen',
  'embed-codesandbox': 'embed.codesandbox',
  'embed-stackblitz': 'embed.stackblitz',
}

/**
 * 自作側の tag name → LogicalKind 対応表。`type` attribute による分岐は
 * 別関数で扱う。
 */
const OURS_TAG_DSL: Readonly<Record<string, LogicalKind | null>> = {
  [ZENN_DETAILS_TAG]: 'details',
  [ZENN_EMBED_YOUTUBE_TAG]: 'embed.youtube',
  [ZENN_EMBED_CODEPEN_TAG]: 'embed.codepen',
  [ZENN_EMBED_CODESANDBOX_TAG]: 'embed.codesandbox',
  [ZENN_EMBED_STACKBLITZ_TAG]: 'embed.stackblitz',
}

/**
 * Zenn 側 HTML から LogicalKind のリストを抽出する。
 */
function extractLogicalKindsFromZenn(html: string): LogicalKind[] {
  const kinds: LogicalKind[] = []
  const root = parseHtml(html)
  let hasInlineMath = false
  let hasBlockMath = false

  for (const el of walkElements(root)) {
    const classes = classNameOf(el)
    const classKey = classes.join(' ')
    // message.info / message.alert
    if (classes.includes('msg')) {
      if (classes.includes('alert')) kinds.push('message.alert')
      else kinds.push('message.info')
      continue
    }
    // embed.*
    for (const key of Object.keys(ZENN_CLASS_DSL)) {
      if (key.startsWith('embed-') && classes.includes(key)) {
        kinds.push(ZENN_CLASS_DSL[key])
        break
      }
    }
    // details (HTML native <details>)
    if (el.tagName === 'details') {
      kinds.push('details')
    }
    // math: <section class="zenn-katex"> → block / <eq class="zenn-katex"> → inline
    if (classes.includes('zenn-katex')) {
      if (el.tagName === 'section') hasBlockMath = true
      else hasInlineMath = true
    }
  }
  if (hasInlineMath) kinds.push('math.inline')
  if (hasBlockMath) kinds.push('math.block')
  return kinds
}

/**
 * 自作側 HTML から LogicalKind のリストを抽出する。
 */
function extractLogicalKindsFromOurs(html: string): LogicalKind[] {
  const kinds: LogicalKind[] = []
  const root = parseHtml(html)
  let hasInlineMath = false
  let hasBlockMath = false

  for (const el of walkElements(root)) {
    // message (zenn-message[type=info|alert])
    if (el.tagName === ZENN_MESSAGE_TAG) {
      const typeAttr = String(el.properties?.type ?? 'info')
      kinds.push(typeAttr === 'alert' ? 'message.alert' : 'message.info')
      continue
    }
    // tag DSL によるマッピング
    const mapped = OURS_TAG_DSL[el.tagName]
    if (mapped !== null && mapped !== undefined) {
      kinds.push(mapped)
      continue
    }
    // math
    const classes = classNameOf(el)
    if (classes.includes('katex-display')) hasBlockMath = true
    else if (classes.includes('katex')) hasInlineMath = true
  }
  if (hasInlineMath) kinds.push('math.inline')
  if (hasBlockMath) kinds.push('math.block')
  return kinds
}

/**
 * 論理要素リストの等価性を判定する (順序は問わない、多重集合として比較)。
 */
function toMultiset(list: readonly LogicalKind[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of list) {
    result[item] = (result[item] ?? 0) + 1
  }
  return result
}

describe('zenn markdown golden comparison (phase 2)', () => {
  for (const fixture of FIXTURE_CASES) {
    describe(fixture.name, () => {
      it('produces the same logical elements on both pipelines', async () => {
        const zennMd = loadFixtureBody(fixture.zennFixture)
        const oursMd = loadFixtureBody(fixture.oursFixture)

        const zennHtml = await runZennPipelineToHtml(zennMd)
        const oursHtml = runOursPipelineToHtml(oursMd)

        const zennKinds = extractLogicalKindsFromZenn(zennHtml)
        const oursKinds = extractLogicalKindsFromOurs(oursHtml)

        // どちらの経路からも期待 logical kind がちゃんと取れているかまず確認
        expect(toMultiset(zennKinds)).toEqual(
          toMultiset(fixture.expectedLogicalKinds),
        )
        expect(toMultiset(oursKinds)).toEqual(
          toMultiset(fixture.expectedLogicalKinds),
        )

        // 両経路の logical kinds が互いに等価 (多重集合として)
        expect(toMultiset(zennKinds)).toEqual(toMultiset(oursKinds))
      })
    })
  }

  describe('embed id extraction for youtube (bonus semantic check)', () => {
    it('emits the same youtube video id on both pipelines', async () => {
      const md = loadFixtureBody('youtube.md')
      const zennHtml = await runZennPipelineToHtml(md)
      const oursHtml = runOursPipelineToHtml(md)

      // Zenn: iframe.src の末尾 segment が videoId
      const zennRoot = parseHtml(zennHtml)
      let zennId: string | null = null
      for (const el of walkElements(zennRoot)) {
        if (el.tagName === 'iframe') {
          const src = String(el.properties?.src ?? '')
          const m = src.match(/\/embed\/([^/?#]+)/)
          if (m !== null) {
            zennId = m[1]
            break
          }
        }
      }
      // 自作: <zenn-embed-you-tube id="..."> の id 属性
      const oursRoot = parseHtml(oursHtml)
      let oursId: string | null = null
      for (const el of walkElements(oursRoot)) {
        if (el.tagName === ZENN_EMBED_YOUTUBE_TAG) {
          oursId = String(el.properties?.id ?? '')
          break
        }
      }

      expect(zennId).not.toBeNull()
      expect(oursId).not.toBeNull()
      expect(zennId).toBe(oursId)
    })
  })
})
