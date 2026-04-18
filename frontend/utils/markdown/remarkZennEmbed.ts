/**
 * Zenn 独自の埋め込み記法 `@[service](url-or-id)` を、`components/content/`
 * 配下の ZennEmbed* MDC コンポーネントへの `containerComponent` mdast ノード
 * に書き換える remark プラグイン。
 *
 * 対応サービス:
 *   - `@[youtube](...)`      → `zenn-embed-you-tube`
 *   - `@[codepen](...)`      → `zenn-embed-code-pen`
 *   - `@[codesandbox](...)`  → `zenn-embed-code-sandbox`
 *   - `@[stackblitz](...)`   → `zenn-embed-stack-blitz`
 *
 * 設計上の選択:
 *   - remark-parse 段階で `@[name](url)` は text(`@`) + link(text=`name`, url)
 *     に分解される。本プラグインは paragraph の children を走査し、この 2 連
 *     ノードパターンを検知する
 *   - URL/ID の正規化はこのプラグイン (rehype ではなく remark) 側に集約する。
 *     そうすることで MDC コンポーネント側は「既に正規化済みの id」だけを
 *     受け取ればよく、バリデーションが 1 箇所 (このファイル + validateEmbedId)
 *     に閉じる
 *   - 不正な URL/ID は build fail。ここで throw することで静かな記事壊れを
 *     避ける
 */
import type { Link, Paragraph, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast'
import {
  ZENN_EMBED_CODEPEN_TAG,
  ZENN_EMBED_CODESANDBOX_TAG,
  ZENN_EMBED_STACKBLITZ_TAG,
  ZENN_EMBED_YOUTUBE_TAG,
} from '../../constants/zenn-mdc'
import {
  validateCodePenPath,
  validateCodeSandboxId,
  validateStackBlitzPath,
  validateYouTubeVideoId,
} from './validateEmbedId'
import type { EmbedIdValidationResult } from './validateEmbedId'

/**
 * remark-mdc 由来の `containerComponent` ノードを本プラグイン内で生成する
 * ため、ローカルで型を宣言する。
 */
interface ContainerComponentNode extends Parent {
  type: 'containerComponent'
  name: string
  attributes?: Record<string, string>
  fmAttributes?: Record<string, unknown>
}

/**
 * `mdast` の RootContent ユニオンに `containerComponent` を注入する
 * module augmentation (remarkZennContainer.ts と同等の内容)。
 */
declare module 'mdast' {
  interface RootContentMap {
    containerComponent: ContainerComponentNode
  }
}

/**
 * throw 時のエラーメッセージ接頭辞。運用ログやテストで grep しやすくするために
 * 固定文字列として公開する。
 */
export const INVALID_ZENN_EMBED_ERROR_PREFIX =
  '[remarkZennEmbed] invalid zenn embed:'

/**
 * 本プラグインが対応する Zenn 埋め込みサービス名。
 */
const ZENN_EMBED_SERVICE_NAMES = {
  youtube: 'youtube',
  codepen: 'codepen',
  codesandbox: 'codesandbox',
  stackblitz: 'stackblitz',
} as const

type EmbedService =
  (typeof ZENN_EMBED_SERVICE_NAMES)[keyof typeof ZENN_EMBED_SERVICE_NAMES]

/**
 * サービス名 → MDC コンポーネントタグ の対応表。
 */
const SERVICE_TAG_MAP: Readonly<Record<EmbedService, string>> = {
  youtube: ZENN_EMBED_YOUTUBE_TAG,
  codepen: ZENN_EMBED_CODEPEN_TAG,
  codesandbox: ZENN_EMBED_CODESANDBOX_TAG,
  stackblitz: ZENN_EMBED_STACKBLITZ_TAG,
}

/**
 * サービスごとに、`@[service](raw)` の raw 値から MDC コンポーネント用の
 * `id` 文字列を抽出・正規化する関数の signature。
 *
 * `raw` には URL かもしれないし、生 ID かもしれない値が渡ってくる。
 * 実装側で両者を吸収する。
 */
type EmbedIdNormalizer = (raw: string) => string

/**
 * サービス名とその Normalizer / Validator の対応表。
 */
const SERVICE_RESOLVERS: Readonly<Record<
  EmbedService,
  {
    normalize: EmbedIdNormalizer
    validate: (id: string) => EmbedIdValidationResult
  }
>> = {
  youtube: {
    normalize: normalizeYouTubeId,
    validate: validateYouTubeVideoId,
  },
  codepen: {
    normalize: normalizeCodePenPath,
    validate: validateCodePenPath,
  },
  codesandbox: {
    normalize: normalizeCodeSandboxId,
    validate: validateCodeSandboxId,
  },
  stackblitz: {
    normalize: normalizeStackBlitzPath,
    validate: validateStackBlitzPath,
  },
}

/**
 * YouTube の origin に使われるホスト集合。`youtu.be` の短縮ドメインと
 * `www.youtube.com` / `youtube.com` / `m.youtube.com` を正規化対象に含める。
 */
const YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
])

/**
 * YouTube の watch URL で video ID を表すクエリキー。
 */
const YOUTUBE_VIDEO_QUERY_KEY = 'v'

/**
 * CodePen の公式ドメイン。URL 形式で来た場合に剥がす対象。
 */
const CODEPEN_HOST = 'codepen.io'

/**
 * CodeSandbox の公式ドメイン。
 */
const CODESANDBOX_HOST = 'codesandbox.io'

/**
 * CodeSandbox の共有 URL パス接頭辞 (`/s/<id>` の `s/`)。
 */
const CODESANDBOX_SHARE_PATH_PREFIX = 's/'

/**
 * StackBlitz の公式ドメイン。
 */
const STACKBLITZ_HOST = 'stackblitz.com'

/**
 * YouTube の生 raw 値から正規化された video ID を返す。
 *
 * 受け付けるパターン:
 *   - `https://www.youtube.com/watch?v=<id>` (クエリから `v` を抽出)
 *   - `https://youtu.be/<id>`               (パス直下を抽出)
 *   - `<id>`                                (素のまま)
 * 不正な URL は素通しして validator 側で invalid 判定させる。
 */
function normalizeYouTubeId(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return trimmed
  }
  if (!looksLikeAbsoluteUrl(trimmed)) {
    return trimmed
  }
  const parsed = safeParseUrl(trimmed)
  if (parsed === null) {
    return trimmed
  }
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
    return trimmed
  }
  if (parsed.hostname === 'youtu.be') {
    // /foo/bar... の先頭セグメントを video ID として取り出す
    return parsed.pathname.replace(/^\//, '').split('/')[0] ?? ''
  }
  // watch?v=... を優先、次いで /embed/<id>
  const videoId = parsed.searchParams.get(YOUTUBE_VIDEO_QUERY_KEY)
  if (videoId !== null && videoId.length > 0) {
    return videoId
  }
  // /embed/<id> or /shorts/<id>
  const match = parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)
  if (match !== null) {
    return match[1]
  }
  return trimmed
}

/**
 * CodePen の生 raw 値から正規化されたパス (`user/pen/id`) を返す。
 */
function normalizeCodePenPath(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return trimmed
  }
  if (!looksLikeAbsoluteUrl(trimmed)) {
    return trimmed
  }
  const parsed = safeParseUrl(trimmed)
  if (parsed === null) {
    return trimmed
  }
  if (parsed.hostname !== CODEPEN_HOST) {
    return trimmed
  }
  return parsed.pathname.replace(/^\//, '').replace(/\/$/, '')
}

/**
 * CodeSandbox の生 raw 値から正規化された sandbox ID を返す。
 *
 * URL 形式の場合、`/s/<id>` の `<id>` 部分を取り出す。素の ID はそのまま返す。
 */
function normalizeCodeSandboxId(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return trimmed
  }
  if (!looksLikeAbsoluteUrl(trimmed)) {
    // 生 ID 扱い。`s/<id>` 形式なら validator 側で許容する。
    return trimmed
  }
  const parsed = safeParseUrl(trimmed)
  if (parsed === null) {
    return trimmed
  }
  if (parsed.hostname !== CODESANDBOX_HOST) {
    return trimmed
  }
  const pathWithoutLeadingSlash = parsed.pathname.replace(/^\//, '')
  if (pathWithoutLeadingSlash.startsWith(CODESANDBOX_SHARE_PATH_PREFIX)) {
    // `s/<id>` 形式。`<id>` 部分を返す。末尾の `/` は空 id を正しく空文字として
    // 残すために `s/<id>` 全体から接頭辞を剥がしてから末尾スラッシュを除去する。
    const idPart = pathWithoutLeadingSlash.slice(
      CODESANDBOX_SHARE_PATH_PREFIX.length,
    )
    return idPart.replace(/\/$/, '')
  }
  return pathWithoutLeadingSlash.replace(/\/$/, '')
}

/**
 * StackBlitz の生 raw 値から正規化されたパスを返す。
 */
function normalizeStackBlitzPath(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return trimmed
  }
  if (!looksLikeAbsoluteUrl(trimmed)) {
    return trimmed
  }
  const parsed = safeParseUrl(trimmed)
  if (parsed === null) {
    return trimmed
  }
  if (parsed.hostname !== STACKBLITZ_HOST) {
    return trimmed
  }
  return parsed.pathname.replace(/^\//, '').replace(/\/$/, '')
}

/**
 * 絶対 URL (http:// / https://) の体裁を持つか判定する。
 *
 * 完全なバリデーションはせず、`new URL` に渡していい見た目かどうかだけ確認。
 */
function looksLikeAbsoluteUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw)
}

/**
 * URL 形式を安全に parse する。失敗時は null を返し、呼び出し側で生文字列
 * 扱いに fallback させる。
 */
function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  }
  catch {
    return null
  }
}

/**
 * paragraph の children 内で「Zenn 埋め込みリンク (text=`@` 末尾 → 直後に
 * link で text = サービス名)」のペアを検知し、該当部分を embed node に
 * 置き換える。
 *
 * 置換後も paragraph 自体は残す。link の前後に通常テキストが並んでいた
 * 場合、embed node は paragraph の inline なので、paragraph 自体を分割
 * する必要がある。本プラグインでは実運用で `@[service](url)` が単独行で
 * 使われることを前提とし、embed node を paragraph の中に inline container
 * として残す。ただし containerComponent は phrasing 型ではないため、
 * 単独行なら paragraph 自体を embed で置き換え、そうでなければ
 * 「text + embed + text」を 3 つのブロックに分解する。
 *
 * 副作用: tree.children を破壊的に差し替える。
 */
function rewriteEmbedLinks(parent: Parent): void {
  const newChildren: RootContent[] = []
  for (const child of parent.children as RootContent[]) {
    if (child.type !== 'paragraph') {
      if ('children' in child && Array.isArray((child as Parent).children)) {
        rewriteEmbedLinks(child as Parent)
      }
      newChildren.push(child)
      continue
    }
    const paragraph = child as Paragraph
    const segments = splitParagraphByEmbed(paragraph)
    for (const seg of segments) {
      newChildren.push(seg)
    }
  }
  parent.children = newChildren as Parent['children']
}

/**
 * 1 つの paragraph を「先頭 text 部、embed containerComponent 群、末尾 text 部」
 * に分割する。
 *
 * embed を検知した場合は paragraph が分割され、RootContent 配列として返される。
 * embed を 1 つも含まない場合は paragraph をそのまま返す。
 */
function splitParagraphByEmbed(paragraph: Paragraph): RootContent[] {
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
    const embed = maybeMakeEmbed(node, next)
    if (embed !== null) {
      // `@` text の末尾 `@` を消す処理。`node` は text、末尾が `@` のはず。
      const head = trimTrailingAtFromText(node as Text)
      if (head !== null) {
        buffer.push(head)
      }
      flushParagraph()
      result.push(embed)
      index += 1 // link も消費
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
 * text node の末尾の `@` を取り除いた新しい text node を返す。
 * 取り除いた結果が空文字なら null を返し、呼び出し側で push を省略する。
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
 * 空白のみの text ノード (改行や半角/全角 space 等) かを判定する。
 */
function isWhitespaceOnlyText(node: PhrasingContent): boolean {
  return node.type === 'text' && /^\s*$/.test(node.value)
}

/**
 * 連続する 2 ノード (text + link) が Zenn 埋め込みのパターンか判定し、
 * 該当すれば containerComponent を返す。非該当なら null。
 *
 * link の url (= raw 値) を Zenn 記法の引数として扱い、正規化と検証を行う。
 * 不正な場合は throw する (build fail)。
 */
function maybeMakeEmbed(
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
  const service = extractServiceName(link)
  if (service === null) {
    return null
  }
  const raw = link.url ?? ''
  const resolver = SERVICE_RESOLVERS[service]
  const id = resolver.normalize(raw)
  const result = resolver.validate(id)
  if (!result.valid) {
    throw new Error(
      `${INVALID_ZENN_EMBED_ERROR_PREFIX} @[${service}](${raw}) - ${result.reason ?? 'unknown reason'}`,
    )
  }
  return buildEmbedContainer(service, id)
}

/**
 * link ノードの children text を連結し、サービス名に該当するか判定する。
 * 該当しなければ null。
 */
function extractServiceName(link: Link): EmbedService | null {
  const text = link.children
    .filter((child): child is Text => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim()
  if (Object.prototype.hasOwnProperty.call(ZENN_EMBED_SERVICE_NAMES, text)) {
    return text as EmbedService
  }
  return null
}

/**
 * サービス名と正規化済み id から containerComponent ノードを作る。
 */
function buildEmbedContainer(
  service: EmbedService,
  id: string,
): ContainerComponentNode {
  const tagName = SERVICE_TAG_MAP[service]
  const attributes = { id }
  return {
    type: 'containerComponent',
    name: tagName,
    attributes,
    children: [],
    data: {
      hName: tagName,
      hProperties: { ...attributes },
    },
  }
}

/**
 * remark プラグイン本体。
 *
 * 処理順:
 *   1. 再帰で parent を走査し、paragraph 単位で Zenn 埋め込みパターンを検知
 *   2. 検知した箇所を containerComponent に置き換え (paragraph 分割あり)
 *   3. 不正な URL/ID は throw して build fail
 */
export default function remarkZennEmbed() {
  return (tree: Root): void => {
    rewriteEmbedLinks(tree)
  }
}
