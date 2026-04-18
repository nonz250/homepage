/**
 * Zenn 独自の Gist 埋め込み記法 `@[gist](URL)` を、`ZennEmbedGist` MDC
 * コンポーネント用の `containerComponent` mdast ノードに書き換える remark
 * プラグイン。
 *
 * 処理の流れ:
 *   1. remark-parse 後の mdast を走査し、`text("...@") + link(text="gist")`
 *      のペアを検知する (他の `@[service](url)` 系と同じパターン)
 *   2. link.url を `validateGistUrl` + `extractGistUserId` で解析する
 *   3. 不正な URL (ホスト違反 / id 形式違反 / スキーム違反など) は `throw`
 *      して build fail させる
 *   4. 正常なら `<zenn-embed-gist user="<user>" id="<id>" url="<元URL>">` に
 *      置換する
 *
 * 設計上の選択:
 *   - Gist は `gist.github.com` のみ許容し、短い / 偽装された URL は static
 *     validator の時点で build fail に倒す
 *   - 元 URL は props に残し、クライアント描画失敗 (JS 無効 / script ロード
 *     失敗) 時の fallback リンク先に使う
 *   - 変換後の `<script>` 挿入は MDC コンポーネント側で `onMounted` で行う
 *     (本 remark プラグインは URL / ID の整形のみ)
 */
import type { Link, Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast'
import { ZENN_EMBED_GIST_TAG } from '../../constants/zenn-mdc'
import { extractGistUserId, validateGistUrl } from './validateEmbedId'

/**
 * remark-mdc 由来の `containerComponent` ノードを本プラグイン内で生成する
 * ため、ローカルで型を宣言する (他の remark-zenn-* プラグインと同じパターン)。
 */
interface ContainerComponentNode extends Parent {
  type: 'containerComponent'
  name: string
  attributes?: Record<string, string>
  fmAttributes?: Record<string, unknown>
}

/**
 * `mdast` の RootContent ユニオンに `containerComponent` を注入する
 * module augmentation。
 */
declare module 'mdast' {
  interface RootContentMap {
    containerComponent: ContainerComponentNode
  }
}

/**
 * throw 時のエラーメッセージ接頭辞。運用ログや単体テストで grep しやすい形。
 */
export const INVALID_ZENN_GIST_ERROR_PREFIX =
  '[remarkZennGist] invalid zenn gist:'

/**
 * gist 識別用のリンクテキスト (= `@[gist](...)` の `gist`)。
 */
const GIST_LINK_TEXT = 'gist'

/**
 * remark プラグイン本体。
 *
 * 処理順:
 *   1. 再帰で parent を走査し、paragraph 単位で `@[gist](url)` を検知
 *   2. 該当箇所を containerComponent に置き換え (paragraph 分割あり)
 *   3. 不正な URL は throw して build fail
 */
export default function remarkZennGist() {
  return (tree: Root): void => {
    rewriteGistLinks(tree)
  }
}

/**
 * parent.children を走査し、paragraph 内の `@[gist](url)` ペアを
 * containerComponent に書き換える。
 *
 * 非 paragraph の parent (list / blockquote など) にも再帰する。
 */
function rewriteGistLinks(parent: Parent): void {
  const newChildren: RootContent[] = []
  for (const child of parent.children as RootContent[]) {
    if (child.type !== 'paragraph') {
      if ('children' in child && Array.isArray((child as Parent).children)) {
        rewriteGistLinks(child as Parent)
      }
      newChildren.push(child)
      continue
    }
    const segments = splitParagraphByGist(child as Paragraph)
    for (const seg of segments) {
      newChildren.push(seg)
    }
  }
  parent.children = newChildren as Parent['children']
}

/**
 * 1 paragraph を「先頭 text 残り / gist ノード / 末尾 text 残り」に分割する。
 *
 * 同一 paragraph 内に複数の `@[gist]` があっても逐次的に分割する。
 */
function splitParagraphByGist(paragraph: Paragraph): RootContent[] {
  const original = paragraph.children
  const result: RootContent[] = []
  let buffer: PhrasingContent[] = []
  const flushParagraph = (): void => {
    if (buffer.length === 0) {
      return
    }
    if (buffer.length === 1 && isWhitespaceOnlyText(buffer[0])) {
      buffer = []
      return
    }
    result.push({ type: 'paragraph', children: buffer })
    buffer = []
  }
  for (let index = 0; index < original.length; index += 1) {
    const node = original[index]
    const next = original[index + 1]
    const embed = maybeMakeGistEmbed(node, next)
    if (embed !== null) {
      const head = trimTrailingAtFromText(node as Text)
      if (head !== null) {
        buffer.push(head)
      }
      flushParagraph()
      result.push(embed)
      index += 1 // link ノードを消費
      continue
    }
    buffer.push(node)
  }
  flushParagraph()
  if (result.length === 0) {
    return [paragraph]
  }
  return result
}

/**
 * 連続する 2 ノード (text + link) が `@[gist](url)` パターンか判定し、
 * 該当すれば containerComponent を返す。非該当なら null。
 *
 * URL が invalid な場合は throw (build fail)。
 */
function maybeMakeGistEmbed(
  prev: PhrasingContent,
  next: PhrasingContent | undefined,
): ContainerComponentNode | null {
  if (next === undefined) {
    return null
  }
  if (prev.type !== 'text' || next.type !== 'link') {
    return null
  }
  if (!prev.value.endsWith('@')) {
    return null
  }
  const link = next as Link
  if (!isGistLink(link)) {
    return null
  }
  const raw = link.url ?? ''
  const validation = validateGistUrl(raw)
  if (!validation.valid) {
    throw new Error(
      `${INVALID_ZENN_GIST_ERROR_PREFIX} @[gist](${raw}) - ${validation.reason ?? 'unknown reason'}`,
    )
  }
  const extracted = extractGistUserId(raw)
  if (extracted === null) {
    throw new Error(
      `${INVALID_ZENN_GIST_ERROR_PREFIX} @[gist](${raw}) - failed to extract user and id`,
    )
  }
  const attributes: Record<string, string> = {
    user: extracted.user,
    id: extracted.id,
    url: raw,
  }
  return {
    type: 'containerComponent',
    name: ZENN_EMBED_GIST_TAG,
    attributes,
    children: [],
    data: {
      hName: ZENN_EMBED_GIST_TAG,
      hProperties: { ...attributes },
    },
  }
}

/**
 * link の内部テキストが `gist` かを判定する。
 */
function isGistLink(link: Link): boolean {
  const text = link.children
    .filter((child): child is Text => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim()
  return text === GIST_LINK_TEXT
}

/**
 * text node の末尾の `@` を取り除いた新しい text node を返す。
 */
function trimTrailingAtFromText(node: Text): Text | null {
  const value = node.value
  if (!value.endsWith('@')) {
    return node
  }
  const stripped = value.slice(0, value.length - 1)
  if (stripped.length === 0) {
    return null
  }
  return { type: 'text', value: stripped }
}

/**
 * 空白のみの text ノード判定。
 */
function isWhitespaceOnlyText(node: PhrasingContent): boolean {
  return node.type === 'text' && /^\s*$/.test(node.value)
}
