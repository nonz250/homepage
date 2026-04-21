import type { Link, Paragraph, Root, RootContent, Text } from 'mdast'
import { EMBED_DIRECTIVE_SENTINEL } from '../../constants'

/**
 * Zenn の埋め込み記法 `@[<service>](<url>)` を、Qiita で auto-embed される
 * **裸 URL + 前後空行** に変換する mdast transform。
 *
 * 対象サービス:
 *   - `@[card](url)`         — OGP カード
 *   - `@[tweet](url)`        — Twitter / X
 *   - `@[youtube](id|url)`   — YouTube
 *   - `@[gist](url)`         — GitHub Gist
 *   - `@[codepen](url)`      — CodePen
 *   - `@[codesandbox](url)`  — CodeSandbox
 *   - `@[stackblitz](url)`   — StackBlitz
 *   - `@[jsfiddle](url)`     — JSFiddle
 *
 * Qiita は通常の裸 URL (前後空行に囲まれた単独行) を埋め込みカードに展開する
 * 動作を持つため、Zenn 独自の `@[service](url)` を剥がして URL だけを残すと
 * Qiita 側で自然に埋め込みになる。
 *
 * 設計:
 *   - remark-parse は `@[card](url)` を `text("@") + link(text="card", url)` の
 *     2 連ノードに分解するため、paragraph の children 内でこのペアを検出して
 *     置換する (既存 frontend/utils/markdown/remarkZennCard.ts と同じ発想)。
 *   - 1 paragraph に複数の embed がある場合、各 embed の前後を空 paragraph
 *     (= 空行) で分離するため、paragraph を複数ブロックに分割する。
 *   - URL は link.url をそのまま使う。`youtube` の `id` を URL に補完するなどの
 *     正規化は **行わない** (責務外。PR-B の generator で必要なら実施)。
 */

/**
 * 本 transform が対象とする Zenn 埋め込みサービス名の集合。
 *
 * ここに載っていないサービス (例: slideshare / figma 等) は
 * `rejectUnsupportedZennSyntax` 側で別途 throw する責務になるため、
 * 本集合と UNSUPPORTED_ZENN_EMBED_NAMES は disjoint (重なりなし)。
 */
const SUPPORTED_EMBED_SERVICES = new Set([
  'card',
  'tweet',
  'youtube',
  'gist',
  'codepen',
  'codesandbox',
  'stackblitz',
  'jsfiddle',
])

/**
 * `@[service](...)` の link ノードがサポート対象サービスか判定する。
 *
 * link.children の先頭 text が service 名に一致すれば true。
 */
function extractSupportedService(link: Link): string | null {
  const text = link.children
    .filter((child): child is Text => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim()
  if (SUPPORTED_EMBED_SERVICES.has(text)) {
    return text
  }
  return null
}

/**
 * text("...@" で終わる) + link (service) の 2 連を embed と判定。
 *
 * 該当する場合はサービス名と link の url を返す。非該当なら null。
 */
function matchEmbedPair(
  prev: Paragraph['children'][number] | undefined,
  next: Paragraph['children'][number] | undefined,
): { service: string; url: string } | null {
  if (prev === undefined || next === undefined) {
    return null
  }
  if (prev.type !== 'text' || next.type !== 'link') {
    return null
  }
  if (!prev.value.endsWith(EMBED_DIRECTIVE_SENTINEL)) {
    return null
  }
  const service = extractSupportedService(next as Link)
  if (service === null) {
    return null
  }
  return { service, url: (next as Link).url }
}

/**
 * 末尾の `@` を剥がした text ノードを返す (空文字化したら null)。
 */
function stripTrailingSentinel(node: Text): Text | null {
  if (!node.value.endsWith(EMBED_DIRECTIVE_SENTINEL)) {
    return node
  }
  const stripped = node.value.slice(0, -EMBED_DIRECTIVE_SENTINEL.length)
  if (stripped.length === 0) {
    return null
  }
  return { type: 'text', value: stripped }
}

/**
 * 1 paragraph を、埋め込みを境に複数ブロックに分割する。
 *
 * 戻り値は RootContent[] で、埋め込み部分は `paragraph > text(url)` の単独
 * ブロックに変換される。前後の地の文は別の paragraph として残る。
 */
function splitParagraphByEmbed(paragraph: Paragraph): RootContent[] {
  const original = paragraph.children
  const result: RootContent[] = []
  let buffer: Paragraph['children'] = []
  const flushParagraph = (): void => {
    if (buffer.length === 0) {
      return
    }
    if (buffer.every((n) => n.type === 'text' && /^\s*$/.test(n.value))) {
      buffer = []
      return
    }
    result.push({ type: 'paragraph', children: buffer })
    buffer = []
  }
  for (let i = 0; i < original.length; i += 1) {
    const node = original[i]
    const next = original[i + 1]
    const embed = matchEmbedPair(node, next)
    if (embed !== null) {
      const head = stripTrailingSentinel(node as Text)
      if (head !== null) {
        buffer.push(head)
      }
      flushParagraph()
      result.push({
        type: 'paragraph',
        children: [{ type: 'text', value: embed.url }],
      })
      i += 1 // link ノードを消費
      continue
    }
    if (node) {
      buffer.push(node)
    }
  }
  flushParagraph()
  if (result.length === 0) {
    // 埋め込みが一つも含まれない場合は元の paragraph を返す。
    return [paragraph]
  }
  return result
}

/**
 * mdast を走査し、paragraph 内の `@[service](url)` を裸 URL の独立段落に
 * 置換する。
 *
 * 副作用: Root (および containerComponent のような親) の children を
 * in-place で差し替える。冪等 (変換後は裸 URL のみになるため再走査しない)。
 */
export function transformCard(tree: Root): void {
  const original = tree.children
  const rewritten: RootContent[] = []
  for (const child of original) {
    if (child.type !== 'paragraph') {
      rewritten.push(child)
      continue
    }
    const segments = splitParagraphByEmbed(child)
    for (const seg of segments) {
      rewritten.push(seg)
    }
  }
  tree.children = rewritten
}
