import type { Link, Paragraph, Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'
import {
  EMBED_DIRECTIVE_SENTINEL,
  UNSUPPORTED_ZENN_EMBED_NAMES,
} from '../constants'

/**
 * Qiita 向けパイプラインで対応不可と判定されている Zenn 記法を検出し、
 * **throw** してビルドを fail させる mdast transform (fail-closed)。
 *
 * 対象: UNSUPPORTED_ZENN_EMBED_NAMES に列挙された名前の `@[name](...)`
 *   記法。具体的には slideshare / speakerdeck / docswell / figma / blueprintue
 *   など、Qiita に公式相当のウィジェットが存在しないか、出しても崩れる
 *   埋め込み。
 *
 * 設計:
 *   - transformCard と同じく、remark-parse は `@[name](url)` を
 *     text("@") + link(text=name, url) の 2 連に分解する。visit で link を
 *     走査し、link の直前に "@" 終わりの text があり、かつ link のテキストが
 *     UNSUPPORTED_ZENN_EMBED_NAMES に含まれていれば throw する。
 *   - エラーメッセージには **行番号** と **記法名** を含める (運用時の grep 性)。
 *   - position 情報が欠落している場合は `unknown` 行として出力する。
 */

/**
 * throw 時のエラーメッセージ接頭辞。運用ログと単体テストで grep しやすい形。
 */
export const UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX =
  '[rejectUnsupportedZennSyntax] unsupported Zenn embed:'

/**
 * UNSUPPORTED_ZENN_EMBED_NAMES を効率的に照会するための Set。
 */
const UNSUPPORTED_NAMES = new Set<string>(UNSUPPORTED_ZENN_EMBED_NAMES)

/**
 * link.children の先頭 text を抽出して trim した文字列を返す。
 */
function extractLinkLabel(link: Link): string {
  return link.children
    .filter((child): child is Text => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim()
}

/**
 * link ノードの直前の sibling text が "@" で終わっているかを判定する。
 */
function hasPrecedingSentinel(
  parent: Paragraph,
  linkIndex: number,
): boolean {
  const prev = parent.children[linkIndex - 1]
  if (!prev || prev.type !== 'text') {
    return false
  }
  return (prev as Text).value.endsWith(EMBED_DIRECTIVE_SENTINEL)
}

/**
 * mdast を走査し、UNSUPPORTED_ZENN_EMBED_NAMES に該当する `@[name](url)` を
 * 見つけたら即座に throw する。
 *
 * 純関数契約: tree を in-place で変更しない。throw のみ。
 */
export function rejectUnsupportedZennSyntax(tree: Root): void {
  visit(tree, 'paragraph', (paragraph) => {
    paragraph.children.forEach((child, index) => {
      if (child.type !== 'link') {
        return
      }
      const link = child as Link
      const label = extractLinkLabel(link)
      if (!UNSUPPORTED_NAMES.has(label)) {
        return
      }
      if (!hasPrecedingSentinel(paragraph, index)) {
        return
      }
      const line = link.position?.start.line ?? 'unknown'
      const url = link.url
      throw new Error(
        `${UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX} @[${label}](${url}) at line ${line}`,
      )
    })
  })
}
