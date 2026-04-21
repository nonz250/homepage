import type { Parent, PhrasingContent, Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Zenn のインライン数式記法 `$expr$` を、Qiita 互換の `` $`expr`$ `` に変換する
 * mdast transform。
 *
 * 背景:
 *   - Zenn (KaTeX) はインライン数式を `$...$` で囲む記法を採用している。
 *   - Qiita (Qiita 仕様) はインライン数式を `` $`...`$ `` (= dollar + backtick
 *     + expr + backtick + dollar) で囲む独自記法を採用している。
 *   - ブロック数式 `$$...$$` は両者共通で通過させる (暫定)。
 *
 * 設計:
 *   - remark-parse は `$...$` を数式として認識しないため、AST 上ではすべて
 *     text ノードに埋め込まれた生文字列として現れる。
 *   - 本 transform は text ノードのうち、コードでない箇所に限って regex で
 *     `$expr$` を検出し `` $`expr`$ `` に置換する。
 *   - 既に backtick で囲まれている (`code`/`inlineCode`) ノードは触らない。
 *     mdast では inlineCode は独立したノード型なので、visit で text のみを
 *     対象にすれば自動的に回避される。
 */

/**
 * インライン数式を検出する regex。
 *
 *   - 先頭: 非 `\` / 非 `$` / 非 backtick の直後 (冪等性の要: 既に Qiita 変換
 *     済みの `` $` `` は再マッチしない)
 *   - 中身: 連続する非改行・非 `$` 文字 (エスケープ文字は許容)
 *   - 末尾: 非 `$` の直後 + backtick が続かないこと (冪等性の要)
 *
 * `([^$\n\\]|\\.)+` のパターンで「`\$` でエスケープされた `$` を含む数式
 * 表現」に対応する。
 */
const INLINE_MATH_PATTERN = /(?<![$\\`])\$(?!`)((?:[^$\n\\]|\\.)+?)\$(?!\$|`)/g

/**
 * Qiita のインライン数式 opener/closer。
 */
const QIITA_INLINE_MATH_OPENER = '$`'
const QIITA_INLINE_MATH_CLOSER = '`$'

/**
 * text node を「text 片」と「数式片」に分割した結果を表すセグメント型。
 *
 * remark-stringify はデフォルトで backtick を `` \` `` にエスケープするため、
 * 数式 `` $`expr`$ `` を text ノードに格納すると意図しない出力になる。
 * 代わりに `html` ノード (raw passthrough) として inline に差し込むことで、
 * Qiita 側の render 時に backtick をそのまま解釈させる。
 */
interface MathSegment {
  readonly kind: 'math'
  readonly raw: string
}

interface TextSegment {
  readonly kind: 'text'
  readonly value: string
}

type Segment = MathSegment | TextSegment

/**
 * 1 text value を、数式と地の文のセグメントに分割する。
 *
 * 数式が 1 つも含まれない場合は `[{ kind: 'text', value }]` をそのまま返す。
 * 数式を見つけるたびに、その前後の地の文を text セグメントとして切り出し、
 * 数式本体を math セグメント (raw Qiita 表記) として挟み込む。
 */
function segmentizeInlineMath(value: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  INLINE_MATH_PATTERN.lastIndex = 0
  for (
    let match = INLINE_MATH_PATTERN.exec(value);
    match !== null;
    match = INLINE_MATH_PATTERN.exec(value)
  ) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length
    if (matchStart > lastIndex) {
      segments.push({
        kind: 'text',
        value: value.slice(lastIndex, matchStart),
      })
    }
    const expr = match[1] ?? ''
    segments.push({
      kind: 'math',
      raw: `${QIITA_INLINE_MATH_OPENER}${expr}${QIITA_INLINE_MATH_CLOSER}`,
    })
    lastIndex = matchEnd
  }
  if (lastIndex < value.length) {
    segments.push({ kind: 'text', value: value.slice(lastIndex) })
  }
  return segments
}

/**
 * Segment[] を mdast phrasing content に変換する。
 *
 *   - text セグメント: `{ type: 'text', value }`
 *   - math セグメント: `{ type: 'html', value }` (raw passthrough)
 */
function segmentsToNodes(segments: Segment[]): PhrasingContent[] {
  return segments.map<PhrasingContent>((seg) => {
    if (seg.kind === 'math') {
      return { type: 'html', value: seg.raw } as PhrasingContent
    }
    return { type: 'text', value: seg.value }
  })
}

/**
 * parent の children を走査し、text ノード内に数式がある場合はセグメント配列に
 * 変換して children を差し替える。html ノードと text ノードを phrasing content
 * の中で混在させるため、paragraph / heading 内でも同じロジックが使える。
 */
function rewriteChildrenMath(parent: Parent): void {
  const original = parent.children as PhrasingContent[]
  const rewritten: PhrasingContent[] = []
  let mutated = false
  for (const child of original) {
    if (child.type === 'text') {
      const textNode = child as Text
      const segments = segmentizeInlineMath(textNode.value)
      if (segments.length === 1 && segments[0]?.kind === 'text') {
        rewritten.push(textNode)
        continue
      }
      for (const node of segmentsToNodes(segments)) {
        rewritten.push(node)
      }
      mutated = true
      continue
    }
    rewritten.push(child)
  }
  if (mutated) {
    parent.children = rewritten as Parent['children']
  }
}

/**
 * mdast を走査し、text ノード内のインライン数式 `$expr$` を Qiita 記法
 * `` $`expr`$ `` に変換する。変換結果は text ノードではなく html ノード
 * (raw passthrough) に格納することで、remark-stringify による backtick
 * エスケープを回避する。
 *
 * - inlineCode / code ノードは visit の対象に含まれない (paragraph 走査を
 *   `paragraph` ノードに限定する形で自然に除外される)。
 * - ブロック `$$...$$` は paragraph の text 内に置かれるが、本 regex は
 *   `$` の直前/直後が `$` の場合を除外するため match しない。
 *
 * 副作用: paragraph / heading など phrasing content を持つ親ノードの
 * children を in-place で置換する。冪等 (再適用時にはすでに html ノード
 * 化されているので text としては再走査されない)。
 */
export function transformMath(tree: Root): void {
  visit(tree, (node) => {
    if (
      node.type === 'paragraph' ||
      node.type === 'heading' ||
      node.type === 'tableCell' ||
      node.type === 'emphasis' ||
      node.type === 'strong'
    ) {
      rewriteChildrenMath(node as Parent)
    }
  })
}
