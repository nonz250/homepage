/**
 * Zenn 独自の外部リンクカード記法 `@[card](URL)` を、build 時に OGP を取得
 * した上で `ZennEmbedCard` MDC コンポーネントに変換する remark プラグイン。
 *
 * 処理の流れ:
 *   1. remark-parse 後の mdast を走査し、`text("@...") + link(text="card")`
 *      のペアを検知する (他の `@[service](url)` 系と同じパターン)。
 *   2. link.url を `validateCardUrl` で静的検査。不正なら build fail。
 *   3. `deps.fetchOgp(url)` で OGP を取得。成功時はメタデータを、失敗時は
 *      URL のホスト名を title に使った fallback card を出力する。
 *   4. `containerComponent(name="zenn-embed-card")` ノードに置き換え、
 *      props を `attributes` に詰める。
 *
 * 設計選択:
 *   - remark プラグインは async transformer として実装する。`fetchOgp` は
 *     I/O を伴うため sync では扱えない。`(tree, _file) => Promise<void>` の
 *     signature で unified に渡せる。
 *   - fetchOgp は DI する。本番は `createNodeHttpClient` + `createFileSystemOgpCache`
 *     + `extractOgp` + `downloadImage` を合成して渡し、テストでは fake を渡す。
 *   - fallback card を選んだ理由: 「記事中に card 記法があるのに URL が死んで
 *     build fail」では執筆体験が悪化する。URL 自体の静的検査 (validateCardUrl)
 *     を通った時点で「記法は正しい」と判断し、OGP 取得失敗は非致命的エラー
 *     として fallback する。
 *   - card 記法は remarkZennEmbed よりも **前** に実行する想定。pipeline 登録
 *     順は `nuxt.config.ts` で管理し、本プラグイン単体では順序依存を持たない。
 */
import type { Link, Paragraph, Parent, Root, RootContent, Text } from 'mdast'
import type { Plugin } from 'unified'
import { ZENN_EMBED_CARD_TAG } from '../../constants/zenn-mdc'
import { validateCardUrl } from './validateEmbedId'
import type { OgpFailure } from '../ogp/fetchOgp'
import type { OgpRecord } from '../ogp/ogpCache'

/**
 * `fetchOgp` の最小 signature。本プラグインは成功 / 失敗の判別のみ行い、
 * キャッシュや http 層の詳細には踏み込まない。
 */
export type FetchOgpFn = (
  url: string,
) => Promise<OgpRecord | OgpFailure>

/**
 * throw 時のエラーメッセージ接頭辞。運用ログや単体テストで grep しやすい形。
 */
export const INVALID_ZENN_CARD_ERROR_PREFIX =
  '[remarkZennCard] invalid zenn card:'

/**
 * containerComponent ノードの最小型。他プラグイン (`remarkZennContainer` /
 * `remarkZennEmbed`) と揃える。
 */
interface ContainerComponentNode extends Parent {
  type: 'containerComponent'
  name: string
  attributes?: Record<string, string>
  fmAttributes?: Record<string, unknown>
}

/**
 * card 識別用のリンクテキスト (= `@[card](...)` の `card`)。
 */
const CARD_LINK_TEXT = 'card'

export interface RemarkZennCardDeps {
  /**
   * build 時に OGP を取得する関数。成功時は `OgpRecord`、失敗時は
   * `OgpFailure` を返す想定。`NO_NETWORK_FETCH` 環境変数が立っている本番で
   * はすべて failure を返す stub を注入する。
   */
  readonly fetchOgp: FetchOgpFn
}

/**
 * remark プラグイン本体。async transformer として登録される。
 *
 * 注意: unified は同期 / 非同期 transformer の両方をサポートするため、
 * `Promise<void>` を返すと `processor.run` 側も Promise 経路になる。
 * Nuxt Content の markdown パイプラインは `@nuxtjs/mdc` 経由で run する
 * 際に await するので問題ない。
 */
const remarkZennCard: Plugin<[RemarkZennCardDeps], Root> = (deps) => {
  return async (tree: Root): Promise<void> => {
    await rewriteCardLinks(tree, deps.fetchOgp)
  }
}

/**
 * parent.children を走査し、paragraph 内の `@[card](url)` ペアを
 * containerComponent に書き換える。
 *
 * 1 paragraph に複数の card が含まれていても、上から順に 1 つずつ
 * containerComponent に落として段落を分割する。
 */
async function rewriteCardLinks(
  parent: Parent,
  fetchOgp: FetchOgpFn,
): Promise<void> {
  const children = parent.children as RootContent[]
  const newChildren: RootContent[] = []
  for (const child of children) {
    if (child.type === 'paragraph') {
      const replaced = await splitParagraphByCard(
        child as Paragraph,
        fetchOgp,
      )
      for (const node of replaced) {
        newChildren.push(node)
      }
      continue
    }
    // ネストした container / list / blockquote 等にも再帰する。
    if ('children' in child && Array.isArray((child as Parent).children)) {
      await rewriteCardLinks(child as Parent, fetchOgp)
    }
    newChildren.push(child)
  }
  parent.children = newChildren as Parent['children']
}

/**
 * 1 paragraph を「先頭 text 残り / card ノード / 末尾 text 残り」に分割する。
 *
 * 同一 paragraph 内に複数 card があれば、逐次分割して複数ブロックとして
 * 返す。card を 1 つも含まない paragraph はそのまま返す。
 */
async function splitParagraphByCard(
  paragraph: Paragraph,
  fetchOgp: FetchOgpFn,
): Promise<RootContent[]> {
  const original = paragraph.children
  const result: RootContent[] = []
  let buffer: Paragraph['children'] = []
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
    const embed = await maybeMakeCardEmbed(node, next, fetchOgp)
    if (embed !== null) {
      const head = trimTrailingAtFromText(node as Text)
      if (head !== null) {
        buffer.push(head)
      }
      flushParagraph()
      result.push(embed)
      index += 1 // link を消費
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
 * text("@" で終わる) + link(text="card", url=...) のペアが card 記法か判定し、
 * 該当すれば containerComponent を構築して返す。非該当なら null。
 *
 * URL が invalid の場合は build fail (throw)。OGP 取得失敗は fallback card
 * として containerComponent を返す (非致命的)。
 */
async function maybeMakeCardEmbed(
  prev: Paragraph['children'][number] | undefined,
  next: Paragraph['children'][number] | undefined,
  fetchOgp: FetchOgpFn,
): Promise<ContainerComponentNode | null> {
  if (prev === undefined || next === undefined) {
    return null
  }
  if (prev.type !== 'text' || next.type !== 'link') {
    return null
  }
  if (!prev.value.endsWith('@')) {
    return null
  }
  const link = next as Link
  if (!isCardLink(link)) {
    return null
  }
  const raw = link.url ?? ''
  const validation = validateCardUrl(raw)
  if (!validation.valid) {
    throw new Error(
      `${INVALID_ZENN_CARD_ERROR_PREFIX} @[card](${raw}) - ${validation.reason ?? 'unknown reason'}`,
    )
  }
  const attributes = await buildCardAttributes(raw, fetchOgp)
  return {
    type: 'containerComponent',
    name: ZENN_EMBED_CARD_TAG,
    attributes,
    children: [],
    data: {
      hName: ZENN_EMBED_CARD_TAG,
      hProperties: { ...attributes },
    },
  }
}

/**
 * link の内部テキストが `card` かを判定する。
 */
function isCardLink(link: Link): boolean {
  const text = link.children
    .filter((child): child is Text => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim()
  return text === CARD_LINK_TEXT
}

/**
 * OGP 取得結果から ZennEmbedCard 用 attributes を組み立てる。
 *
 * 成功時は OGP の title / description / url / imagePath / siteName を props
 * に載せ、失敗時は URL のホスト名を title にした最小カードを返す。
 *
 * MDC は attribute 値を全て文字列として扱うため、null の代わりに空文字で
 * 表現する。コンポーネント側は `''` を `null` として判断する (プロパティ
 * オプションの型で `imagePath?: string | null` を指定)。
 */
async function buildCardAttributes(
  url: string,
  fetchOgp: FetchOgpFn,
): Promise<Record<string, string>> {
  const result = await fetchOgp(url)
  if ('ok' in result && result.ok === false) {
    return buildFallbackAttributes(url)
  }
  const record = result as OgpRecord
  return {
    title: record.title,
    description: record.description,
    url: record.url,
    'image-path': record.imagePath ?? '',
    'site-name': record.siteName ?? '',
  }
}

/**
 * OGP 取得失敗時の fallback attributes。title は URL のホスト名、それ以外
 * は空文字で埋める。
 */
function buildFallbackAttributes(url: string): Record<string, string> {
  let host = url
  try {
    host = new URL(url).hostname
  }
  catch {
    host = url
  }
  return {
    title: host,
    description: '',
    url,
    'image-path': '',
    'site-name': '',
  }
}

/**
 * text node の末尾の `@` を取り除いた新しい text node を返す。空文字化した
 * ときは null を返して push を省略する。
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
 * 空白のみの text ノード判定。段落を押し出したときに余る空白 text を
 * 捨てるために使う。
 */
function isWhitespaceOnlyText(
  node: Paragraph['children'][number],
): boolean {
  return node.type === 'text' && /^\s*$/.test(node.value)
}

export default remarkZennCard
