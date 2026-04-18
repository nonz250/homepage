/**
 * Zenn 独自の Tweet 埋め込み記法 `@[tweet](URL)` を、`ZennEmbedTweet` MDC
 * コンポーネント用の `containerComponent` mdast ノードに書き換える remark
 * プラグイン。
 *
 * 処理の流れ:
 *   1. remark-parse 後の mdast を走査し、`text("...@") + link(text="tweet")`
 *      のペアを検知する (他の `@[service](url)` 系と同じパターン)
 *   2. link.url を `validateTweetUrl` + `extractTweetId` で解析する
 *   3. 不正な URL / ID は `throw` して build fail させる
 *   4. 正常なら `<zenn-embed-tweet id="<TweetID>" url="<元URL>">` に置換する
 *
 * 設計上の選択:
 *   - 素の ID (`1234567890`) 単体入力は許容しない。validator 側で URL を
 *     要求するため、ID のみの `@[tweet](1234567890)` は build fail
 *   - 変換後ノードの props に元 URL を残すのは、クライアント描画前 (SSR
 *     fallback) で `<a href>` として遷移先にするため
 *   - remarkZennEmbed / remarkZennCard と signature を揃え、`nuxt.config.ts`
 *     での登録順序だけで pipeline を組み替えられるようにする
 */
import type { Link, Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast'
import { ZENN_EMBED_TWEET_TAG } from '../../constants/zenn-mdc'
import { extractTweetId, validateTweetUrl } from './validateEmbedId'

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
export const INVALID_ZENN_TWEET_ERROR_PREFIX =
  '[remarkZennTweet] invalid zenn tweet:'

/**
 * tweet 識別用のリンクテキスト (= `@[tweet](...)` の `tweet`)。
 */
const TWEET_LINK_TEXT = 'tweet'

/**
 * remark プラグイン本体。
 *
 * 処理順:
 *   1. 再帰で parent を走査し、paragraph 単位で `@[tweet](url)` を検知
 *   2. 該当箇所を containerComponent に置き換え (paragraph 分割あり)
 *   3. 不正な URL は throw して build fail
 */
export default function remarkZennTweet() {
  return (tree: Root): void => {
    rewriteTweetLinks(tree)
  }
}

/**
 * parent.children を走査し、paragraph 内の `@[tweet](url)` ペアを
 * containerComponent に書き換える。
 *
 * 非 paragraph の parent (list / blockquote など) にも再帰し、内側の
 * paragraph を同じルールで処理する。
 */
function rewriteTweetLinks(parent: Parent): void {
  const newChildren: RootContent[] = []
  for (const child of parent.children as RootContent[]) {
    if (child.type !== 'paragraph') {
      if ('children' in child && Array.isArray((child as Parent).children)) {
        rewriteTweetLinks(child as Parent)
      }
      newChildren.push(child)
      continue
    }
    const segments = splitParagraphByTweet(child as Paragraph)
    for (const seg of segments) {
      newChildren.push(seg)
    }
  }
  parent.children = newChildren as Parent['children']
}

/**
 * 1 paragraph を「先頭 text 残り / tweet ノード / 末尾 text 残り」に分割する。
 *
 * 同一 paragraph 内に複数の `@[tweet]` があっても逐次的に分割し、複数ブロック
 * として返す。tweet を 1 つも含まない paragraph はそのまま返す。
 */
function splitParagraphByTweet(paragraph: Paragraph): RootContent[] {
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
    const embed = maybeMakeTweetEmbed(node, next)
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
 * 連続する 2 ノード (text + link) が `@[tweet](url)` パターンか判定し、
 * 該当すれば containerComponent を返す。非該当なら null。
 *
 * URL が invalid な場合は throw (build fail)。
 */
function maybeMakeTweetEmbed(
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
  if (!isTweetLink(link)) {
    return null
  }
  const raw = link.url ?? ''
  const validation = validateTweetUrl(raw)
  if (!validation.valid) {
    throw new Error(
      `${INVALID_ZENN_TWEET_ERROR_PREFIX} @[tweet](${raw}) - ${validation.reason ?? 'unknown reason'}`,
    )
  }
  const id = extractTweetId(raw)
  if (id === null) {
    // validator が通った時点で extract も成功するはずだが、型的に null を
    // 返しうるので万が一に備えて build fail に倒す。
    throw new Error(
      `${INVALID_ZENN_TWEET_ERROR_PREFIX} @[tweet](${raw}) - failed to extract Tweet ID`,
    )
  }
  const attributes: Record<string, string> = { id, url: raw }
  return {
    type: 'containerComponent',
    name: ZENN_EMBED_TWEET_TAG,
    attributes,
    children: [],
    data: {
      hName: ZENN_EMBED_TWEET_TAG,
      hProperties: { ...attributes },
    },
  }
}

/**
 * link の内部テキストが `tweet` かを判定する。
 */
function isTweetLink(link: Link): boolean {
  const text = link.children
    .filter((child): child is Text => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim()
  return text === TWEET_LINK_TEXT
}

/**
 * text node の末尾の `@` を取り除いた新しい text node を返す。取り除いた結果が
 * 空文字なら null を返し、呼び出し側で push を省略する。
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
 * 空白のみの text ノード判定。段落分割の副産物として残る空白 text を捨てる。
 */
function isWhitespaceOnlyText(node: PhrasingContent): boolean {
  return node.type === 'text' && /^\s*$/.test(node.value)
}
