/**
 * Zenn 独自のコンテナ記法 `:::message` / `:::message alert` / `:::details <title>`
 * を、`components/content/` 配下の MDC コンポーネント (`ZennMessage` /
 * `ZennDetails`) に対応する `containerComponent` mdast ノードに書き換える
 * remark プラグイン。
 *
 * 役割:
 *   - Nuxt Content (`@nuxtjs/mdc`) はデフォルトで `remark-mdc` を組み込み、
 *     引数なしの `:::message` / `:::details` のみを `containerComponent` に
 *     昇格させる
 *   - `:::message alert` / `:::details 詳しくはこちら` のような引数付きの
 *     Zenn 記法は remark-mdc のパーサでは attribute 記法 (`{attr="val"}`) では
 *     ないため、paragraph の生 text として残ってしまう
 *   - 本プラグインは remark-mdc が走った **後** に、
 *     1. `containerComponent(name="message"|"details")` をリネーム + 属性補完
 *     2. 生 text として残った引数付き記法を走査して containerComponent に昇格
 *     を行い、Zenn 記法と MDC コンポーネントの橋渡しを完結させる
 *
 * 設計上の選択:
 *   - remark-mdc を置き換える (parser を差し替える) のではなく、AST を後段で
 *     書き換える方針を取る。これは @nuxtjs/mdc が defu による plugin マージ
 *     (defaults 先、user key 後追加) を行うため、ユーザー plugin は必ず
 *     remark-mdc の後に実行される制約があるため
 *   - 引数付きコンテナを再構築する際は「コンテナ全体の生 Markdown を再 parse」
 *     せず、既にパース済みの mdast children を組み替えるだけにする。これは
 *     連続する paragraph 内部のインラインリンクや強調が既に mdast 化済みの
 *     ため、再 parse は冗長かつ危険 (二重処理) になるため
 *   - 開始段落 (text が `:::message alert\n...` で始まる) から、閉じ段落
 *     (text が `...\n:::` で終わる) までの連続 block を一括で containerComponent
 *     に入れ、中間段落は container の children としてそのまま移設する
 */
import type { Paragraph, Parent, Root, RootContent, Text } from 'mdast'
import {
  ZENN_DETAILS_TAG,
  ZENN_MESSAGE_TAG,
} from '../../constants/zenn-mdc'

/**
 * remark-mdc は `mdast` 本体の型に含まれない `containerComponent` ノードを
 * 生成するが、公式型定義での追加は行っていない。本プラグイン内では
 * 後続処理で `RootContent` に混在させる必要があるため、module augmentation で
 * `mdast.RootContentMap` に自前の拡張を注入する。
 *
 * 注: `mdast` の v5+ は `RootContentMap` を提供するが、v4 互換のため安全な
 * 書き方としてシンプルに `type: 'containerComponent'` の interface を
 * `RootContent` のユニオンに足す方式にする。
 */
declare module 'mdast' {
  interface RootContentMap {
    containerComponent: ContainerComponentNode
  }
  interface PhrasingContentMap {
    // phrasing にはならないので空。module augmentation の consistency 用。
  }
}

/**
 * `:::message` の alert 引数。Zenn 本家が定義する唯一の「非 info」値。
 */
const MESSAGE_ALERT_KEYWORD = 'alert'

/**
 * `:::message` の既定 type 値。引数が無い場合にこの値を補完する。
 */
const MESSAGE_DEFAULT_TYPE = 'info'

/**
 * `:::message alert` を変換した結果の type 属性値。
 */
const MESSAGE_ALERT_TYPE = 'alert'

/**
 * remark-mdc が生成する containerComponent の `name` フィールドの内、本
 * プラグインがリネーム対象とする Zenn 記法由来の値。
 */
const ZENN_SOURCE_CONTAINER_NAMES = {
  message: 'message',
  details: 'details',
} as const

/**
 * paragraph の text value から「Zenn 開始行」を検出する正規表現。
 *
 * グループ:
 *   1. name (`message` / `details`)
 *   2. name に続く空白区切りの引数部 (任意)
 *
 * 行頭アンカー `^` + 直後の改行までを 1 行として扱う。`:::` の後に name が
 * 連続する (空白なしで `message` 等) 書き方のみ正規な Zenn 記法。
 */
const ZENN_OPENER_FIRST_LINE_PATTERN =
  /^:::(message|details)(?:\s+([^\n]*))?(?:\n|$)/

/**
 * paragraph の text value が `:::` (閉じ行) で終わっているか。
 */
const ZENN_CLOSER_PATTERN = /(?:^|\n):::$/

/**
 * remark-mdc が生成する containerComponent ノードに期待する AST シェイプ。
 *
 * `mdast` 本体の型定義には含まれないため、本プラグイン用に最小限の型を
 * 手書きする。`data.hName` / `data.hProperties` は remark-mdc が hast 変換時
 * に参照するフィールド (remark-mdc が Data を module augmentation で拡張済)。
 */
interface ContainerComponentNode extends Parent {
  type: 'containerComponent'
  name: string
  attributes?: Record<string, string>
  fmAttributes?: Record<string, unknown>
}

/**
 * RootContent を「containerComponent 型」に narrow する type guard。
 */
function isContainerComponent(
  node: RootContent,
): node is ContainerComponentNode {
  return (node as { type?: string }).type === 'containerComponent'
}

/**
 * RootContent が paragraph であるかを narrow する type guard。
 */
function isParagraph(node: RootContent): node is Paragraph {
  return node.type === 'paragraph'
}

/**
 * paragraph の直下に text ノードが 1 つだけある構造かを判定する。
 *
 * Zenn の開始行/閉じ行だけの paragraph はこの構造になる (インライン記法を
 * 含まないため)。中間段落は複数の children を持ちうるので、それは別判定。
 */
function isSingleTextParagraph(
  paragraph: Paragraph,
): paragraph is Paragraph & { children: [Text] } {
  return (
    paragraph.children.length === 1 &&
    paragraph.children[0]?.type === 'text'
  )
}

/**
 * 開始 paragraph (1つめの text 行) を解析し、Zenn コンテナ情報を抽出する。
 *
 * 戻り値:
 *   - name: `message` or `details`
 *   - attributes: MDC に渡す属性
 *   - leadingText: paragraph の残り (開始行を除いた本文)。空なら null
 *   - closesInSameParagraph: 開始 paragraph 内で `\n:::` で既に閉じている
 */
interface OpenerInfo {
  readonly name: 'message' | 'details'
  readonly attributes: Record<string, string>
  readonly leadingText: string | null
  readonly closesInSameParagraph: boolean
}

/**
 * 開始 paragraph を解析し、そこから OpenerInfo を構築する。
 * 対象外 (Zenn 開始行でない) なら null を返す。
 */
function parseOpener(paragraph: Paragraph): OpenerInfo | null {
  if (!isSingleTextParagraph(paragraph)) {
    // 単一 text でない = 開始行の直後にリンクや強調等のインライン記法が続く
    // ケース。Zenn の開始行は `:::<name> <args>\n` で改行を含むため、
    // 通常はこのケースには入らない。本プラグインでは single-text のみ対応。
    return null
  }
  const text = paragraph.children[0].value
  const match = text.match(ZENN_OPENER_FIRST_LINE_PATTERN)
  if (match === null) {
    return null
  }
  const rawName = match[1]
  const rawArg = (match[2] ?? '').trim()
  if (
    rawName !== ZENN_SOURCE_CONTAINER_NAMES.message &&
    rawName !== ZENN_SOURCE_CONTAINER_NAMES.details
  ) {
    return null
  }
  const name = rawName
  const attributes =
    name === ZENN_SOURCE_CONTAINER_NAMES.message
      ? buildMessageAttributes(rawArg)
      : buildDetailsAttributes(rawArg)
  const headerLength = match[0].length
  const remainder = text.slice(headerLength)
  const closesInSameParagraph = ZENN_CLOSER_PATTERN.test(remainder)
  const stripped = closesInSameParagraph
    ? remainder.replace(ZENN_CLOSER_PATTERN, '')
    : remainder
  const trimmed = stripped.replace(/^\n/, '').replace(/\n$/, '')
  const leadingText = trimmed.length > 0 ? trimmed : null
  return { name, attributes, leadingText, closesInSameParagraph }
}

/**
 * `:::message` の引数部から MDC 用 attribute を構築する。
 *
 * 引数が `alert` なら type=alert、それ以外 (空など) なら type=info。
 */
function buildMessageAttributes(rawArg: string): Record<string, string> {
  const type = rawArg === MESSAGE_ALERT_KEYWORD
    ? MESSAGE_ALERT_TYPE
    : MESSAGE_DEFAULT_TYPE
  return { type }
}

/**
 * `:::details` の引数部から MDC 用 attribute を構築する。
 *
 * 引数はそのまま title として扱う (空白含む全文字列)。空なら title="" として
 * 埋め、コンポーネント側の「未指定」と同等の表示にする。
 */
function buildDetailsAttributes(rawArg: string): Record<string, string> {
  return { title: rawArg }
}

/**
 * paragraph が Zenn コンテナの閉じ行 (`:::` のみ) かを判定する。
 */
function isCloserParagraph(paragraph: Paragraph): boolean {
  if (!isSingleTextParagraph(paragraph)) {
    return false
  }
  return paragraph.children[0].value.trimEnd() === ':::'
}

/**
 * paragraph の末尾 `:::` を剥がした新しい text value を返す。
 * `:::` が末尾に無い場合は元の value をそのまま返す。
 */
function stripCloser(paragraph: Paragraph): Paragraph {
  if (!isSingleTextParagraph(paragraph)) {
    return paragraph
  }
  const value = paragraph.children[0].value
  const newValue = value.replace(ZENN_CLOSER_PATTERN, '').replace(/\n$/, '')
  return {
    type: 'paragraph',
    children: [{ type: 'text', value: newValue }],
  }
}

/**
 * 開始 paragraph の leadingText (= 開始行を除いた本文) から新しい paragraph を
 * 作る。leadingText が空なら null を返し、呼び出し側で push をスキップする。
 */
function buildLeadingParagraph(leadingText: string | null): Paragraph | null {
  if (leadingText === null) {
    return null
  }
  return {
    type: 'paragraph',
    children: [{ type: 'text', value: leadingText }],
  }
}

/**
 * Zenn コンテナ情報から containerComponent ノードを組み立てる。
 *
 * data.hName / data.hProperties は remark-mdc → mdast-util-to-hast の変換で
 * タグ名 / 属性として採用される必須フィールド。`attributes` は remark-mdc
 * 生成ノードと同じ表現にする (後続で別プラグインが依存した場合の互換性)。
 */
function makeContainerComponent(
  opener: OpenerInfo,
  children: RootContent[],
): ContainerComponentNode {
  const tagName =
    opener.name === ZENN_SOURCE_CONTAINER_NAMES.message
      ? ZENN_MESSAGE_TAG
      : ZENN_DETAILS_TAG
  return {
    type: 'containerComponent',
    name: tagName,
    attributes: opener.attributes,
    children,
    data: {
      hName: tagName,
      hProperties: { ...opener.attributes },
    },
  }
}

/**
 * remark-mdc が生成した `containerComponent(name="message"|"details")` を
 * Zenn 用タグ (`zenn-message`/`zenn-details`) にリネームし、既定属性を補完する。
 */
function rewriteLiftedContainers(parent: Parent): void {
  for (const child of parent.children as RootContent[]) {
    if (isContainerComponent(child)) {
      maybeRenameContainer(child)
    }
    // 中身にも再帰する。containerComponent の内部にさらに :::message が
    // ネストされているケースに備える。
    if ('children' in child && Array.isArray((child as Parent).children)) {
      rewriteLiftedContainers(child as Parent)
    }
  }
}

/**
 * 1 つの containerComponent が Zenn 元の name を持っていれば、MDC タグ名に
 * リネームする。既に `zenn-` 接頭辞が付いているノードは触らない (冪等性)。
 */
function maybeRenameContainer(node: ContainerComponentNode): void {
  if (node.name === ZENN_SOURCE_CONTAINER_NAMES.message) {
    const attributes = {
      ...buildMessageAttributes(''),
      ...(node.attributes ?? {}),
    }
    node.name = ZENN_MESSAGE_TAG
    node.attributes = attributes
    node.data = {
      ...(node.data ?? {}),
      hName: ZENN_MESSAGE_TAG,
      hProperties: { ...attributes },
    }
    return
  }
  if (node.name === ZENN_SOURCE_CONTAINER_NAMES.details) {
    const attributes = {
      ...buildDetailsAttributes(''),
      ...(node.attributes ?? {}),
    }
    node.name = ZENN_DETAILS_TAG
    node.attributes = attributes
    node.data = {
      ...(node.data ?? {}),
      hName: ZENN_DETAILS_TAG,
      hProperties: { ...attributes },
    }
  }
}

/**
 * parent の children を走査して「引数付き Zenn 開始 paragraph → (中間 children)
 * → 閉じ paragraph」のパターンを containerComponent に変換する。
 *
 * 再帰的に parent.children を処理して、containerComponent の内側にネストした
 * Zenn コンテナも扱えるようにする。開始のみで閉じが見つからない場合は変換
 * しない (= build fail ではなく、元の paragraph として残す)。`:::` の対応
 * 取りは remark-mdc が引数なしコンテナで行うため、引数付きで閉じ忘れが起きた
 * 場合は後段の rehypeAssertNoZennLeftovers が検知して失敗させる責務を負う。
 */
function rewriteArgumentedContainers(parent: Parent): void {
  const children = parent.children as RootContent[]
  const rewritten: RootContent[] = []
  let index = 0
  while (index < children.length) {
    const current = children[index]
    if (current && current.type === 'paragraph') {
      const opener = parseOpener(current as Paragraph)
      if (opener !== null) {
        const contentChildren: RootContent[] = []
        const leading = buildLeadingParagraph(opener.leadingText)
        if (leading !== null) {
          contentChildren.push(leading)
        }
        if (opener.closesInSameParagraph) {
          // 単一 paragraph に `:::xxx\nbody\n:::` が詰め込まれているケース。
          // body は leading として既に push 済み。
          rewritten.push(makeContainerComponent(opener, contentChildren))
          index += 1
          continue
        }
        // 閉じ行を探す
        let closeIndex = -1
        for (let j = index + 1; j < children.length; j += 1) {
          const sibling = children[j]
          if (sibling && sibling.type === 'paragraph') {
            const paragraph = sibling as Paragraph
            if (isCloserParagraph(paragraph)) {
              closeIndex = j
              break
            }
            // 閉じ paragraph ではないが、最終 text が `\n:::` で終わっていれば
            // そこが close 行を兼ねる。
            if (
              isSingleTextParagraph(paragraph) &&
              ZENN_CLOSER_PATTERN.test(paragraph.children[0].value)
            ) {
              contentChildren.push(stripCloser(paragraph))
              closeIndex = j
              break
            }
            // それ以外は中間段落として追加
            contentChildren.push(paragraph)
            continue
          }
          // paragraph 以外 (heading, list 等) も中間 children として追加
          if (sibling) {
            contentChildren.push(sibling)
          }
        }
        if (closeIndex === -1) {
          // 閉じ行が見つからない。変換しないでそのまま push し、後段の
          // rehypeAssertNoZennLeftovers に検知させる。
          rewritten.push(current)
          index += 1
          continue
        }
        rewritten.push(makeContainerComponent(opener, contentChildren))
        index = closeIndex + 1
        continue
      }
    }
    rewritten.push(current)
    index += 1
  }
  parent.children = rewritten as Parent['children']
  // rewrite 後、さらに containerComponent 内部にもネストされた Zenn 記法がある
  // 可能性があるため再帰する。
  for (const child of parent.children as RootContent[]) {
    if ('children' in child && Array.isArray((child as Parent).children)) {
      rewriteArgumentedContainers(child as Parent)
    }
  }
}

/**
 * remark プラグイン本体。
 *
 * 処理順:
 *   1. `rewriteLiftedContainers`: remark-mdc が既に昇格させた containerComponent
 *      を Zenn 向けにリネーム + 属性補完
 *   2. `rewriteArgumentedContainers`: 生 text として残った引数付き Zenn 記法を
 *      containerComponent に昇格
 *
 * 2 を先にやると「リネーム処理が重複する」ため、順番は 1 → 2 固定。
 * フォーマットが非破壊的なので、冪等実行可 (2 回走らせても同じ結果)。
 */
export default function remarkZennContainer() {
  return (tree: Root): void => {
    rewriteLiftedContainers(tree)
    rewriteArgumentedContainers(tree)
    // rewriteArgumentedContainers は containerComponent ノードを生成するが、
    // これらの name は最初から zenn-* になっているため rewriteLiftedContainers
    // の再適用は不要。
    // 残念ながら containerComponent の name が "message"/"details" のまま
    // 追加で混入した場合に備え、最終 pass を再度走らせて冪等性を担保する。
    rewriteLiftedContainers(tree)
  }
}

