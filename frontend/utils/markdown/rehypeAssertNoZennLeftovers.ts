/**
 * フェーズ 2 で未対応の Zenn 独自記法が HAST に残っていたらビルドを fail させる
 * rehype プラグイン。
 *
 * 役割:
 *   - Phase 2 で対応する記法 (message / details コンテナ、画像、埋め込み) は
 *     対応する remark/rehype プラグインによって変換済みなので、HAST に
 *     ソース記法のままは残らない想定
 *   - それでも未対応の `@[card]`, `@[tweet]`, `@[gist]`, `@[mermaid]` や、
 *     未知の種別を持つ `:::xxx` コンテナが残留していれば、記事の「静かな
 *     壊れ」を招く前にビルドで弾く
 *
 * 実装方針:
 *   - 誤検知 (例: コードブロック中の単なる `@[...]` 記述) を避けるため、
 *     `<code>` / `<pre>` の祖先を持つノードはスキップする
 *   - `:::xxx` 系は通常 paragraph の text node に残留するので、text 値を
 *     正規表現で検査する
 *   - `@[name](url)` 系は Markdown パース時に link 要素として解析されるため、
 *     「直前の text が `@` で終わる `<a>` 要素」を検知するパターンで拾う
 *   - エラー時は「どの記法」「どの原文」を含めて throw し、執筆者がすぐ
 *     修正できるようにする
 */
import type { Root, Element, Text, RootContent, ElementContent } from 'hast'

/**
 * フェーズ 2 で対応済みの `:::xxx` コンテナ種別。
 *
 * - `message` / `message alert`: 警告メッセージ
 * - `details`: 折り畳み可能な詳細ブロック
 *
 * ここに含まれない `:::xxx` (例: `:::warning`, `:::tip`) は未対応としてビルドを
 * fail させる対象になる。
 */
const SUPPORTED_CONTAINER_NAMES: readonly string[] = Object.freeze([
  'message',
  'message alert',
  'details',
])

/**
 * `@[name]` 形式のうち、text node にそのまま残留する珍しいケース (コード等で
 * エスケープされていない場合) を拾う正規表現。
 *
 * 通常の `@[name](url)` は Markdown パーサが `@` + link として分解するため
 * text 値としては残らない。だが `@[name]\n` 等 URL 部が無い変種や、改行を
 * 挟むケースでは text node として残りうる。
 */
const ZENN_EMBED_DIRECTIVE_PATTERN = /@\[([A-Za-z][A-Za-z0-9_-]*)\]/g

/**
 * フェーズ 2 で対応済みの `@[name]` 記法 (埋め込み系)。これに該当しない name を
 * 持つ `@[xxx]` が本 rehype プラグインの時点で残っていたら build fail。
 *
 * 注意: これらの name は `remarkZennEmbed` (Batch C) が処理すると
 * HAST に link として残らないはずなので、ここに来る時点で未変換 = 失敗扱い。
 */
const SUPPORTED_EMBED_NAMES: readonly string[] = Object.freeze([
  'youtube',
  'codepen',
  'codesandbox',
  'stackblitz',
])

/**
 * `:::xxx` コンテナの残留を検知する正規表現。
 *
 * 行頭 (あるいは改行直後) にある `:::name` を拾う。`g` フラグ付き。`name` は
 * 英数字 / スペース (例: `message alert`) を許容する。
 *
 * 注意: multiline の照合には String の標準メソッドで十分。`matchAll` を
 * 利用するため stateful な RegExp は使わないが、ここでは再利用しないので
 * そのまま `g` + `m` を付けている。
 */
const ZENN_CONTAINER_OPENER_PATTERN = /^:::([A-Za-z][A-Za-z0-9 ]*)(?=\s|$)/gm

/**
 * throw 時のエラーメッセージ接頭辞。テストや運用ログで grep しやすい形にする。
 */
export const UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX =
  '[rehypeAssertNoZennLeftovers] unsupported zenn syntax detected:'

/**
 * 検知された違反箇所を表す内部型。
 */
interface Leftover {
  readonly kind: 'embed' | 'container'
  readonly raw: string
  readonly name: string
}

/**
 * コード文脈 (`<code>`/`<pre>`) にぶら下がる text node を無視するため、
 * 走査時の祖先 tagName スタックを見て「コードブロック内」を判定する。
 */
const CODE_ELEMENT_TAG_NAMES: readonly string[] = Object.freeze(['code', 'pre'])

/**
 * rehype プラグイン本体。HAST の root を受け取り、
 *   - text node: `:::xxx` / `@[xxx]` の文字列残留を検査
 *   - `<a>` 要素: 「直前 text が `@` で終わり、`<a>` 配下 text が未対応 name」
 *                というリンクパターンを検査
 * を行い、未対応 Zenn 記法が残っていれば throw する。
 */
export default function rehypeAssertNoZennLeftovers() {
  return (tree: Root): void => {
    const leftovers: Leftover[] = []
    walk(tree, [], leftovers)
    if (leftovers.length === 0) {
      return
    }
    throw new Error(buildErrorMessage(leftovers))
  }
}

/**
 * HAST 走査本体。純粋再帰で DFS し、text node と element の両方を検査する。
 *
 * `ancestorTagNames` はその node に至るまでの element 祖先の tagName 列。
 * code/pre の中では検査しない (コード例の中に `@[xxx]` が書かれていても
 * それは実行対象ではない)。
 */
function walk(
  node: Root | Element | RootContent | ElementContent,
  ancestorTagNames: readonly string[],
  leftovers: Leftover[],
): void {
  if (isInsideCode(ancestorTagNames)) {
    // コード文脈配下は検査しない。再帰は継続して内側要素へ進んでも
    // すべて同じ祖先判定で弾けるが、そもそも意味がないので早期 return。
    return
  }
  if (node.type === 'text') {
    collectTextLeftovers(node as Text, leftovers)
    return
  }
  if (node.type === 'element' || node.type === 'root') {
    const parentNode = node as Root | Element
    if (parentNode.type === 'element') {
      collectAnchorLeftovers(parentNode as Element, leftovers)
    }
    const nextAncestors =
      parentNode.type === 'element'
        ? [...ancestorTagNames, parentNode.tagName]
        : ancestorTagNames
    for (const child of iterateChildren(parentNode)) {
      walk(child, nextAncestors, leftovers)
    }
  }
}

/**
 * `<a>` 要素と、そのすぐ手前の兄弟 text node のペアを検査する。
 *
 * Zenn の `@[name](url)` は Markdown で `@` + `[name](url)` = text + link に
 * 分解されるため、「text が `@` で終わる → 直後の `<a>` 内部 text が未対応
 * name である」という条件で残留を判定する。
 *
 * 副作用: `leftovers` に違反を push するだけ。
 */
function collectAnchorLeftovers(
  parent: Element | Root,
  leftovers: Leftover[],
): void {
  const children = parent.children
  for (let index = 1; index < children.length; index += 1) {
    const prev = children[index - 1]
    const current = children[index]
    if (!prev || !current) {
      continue
    }
    if (prev.type !== 'text') {
      continue
    }
    if (current.type !== 'element') {
      continue
    }
    if ((current as Element).tagName !== 'a') {
      continue
    }
    if (!((prev as Text).value ?? '').endsWith('@')) {
      continue
    }
    const name = extractAnchorText(current as Element)
    if (name.length === 0) {
      continue
    }
    if (SUPPORTED_EMBED_NAMES.includes(name)) {
      continue
    }
    leftovers.push({ kind: 'embed', raw: `@[${name}]`, name })
  }
}

/**
 * `<a>` element 配下を flatten して text 値を連結する。
 */
function extractAnchorText(anchor: Element): string {
  let buffer = ''
  for (const child of anchor.children) {
    if (child.type === 'text') {
      buffer += (child as Text).value ?? ''
    }
    else if (child.type === 'element') {
      buffer += extractAnchorText(child as Element)
    }
  }
  return buffer
}

/**
 * `Root` / `Element` の children を null 安全に返す。
 */
function iterateChildren(parent: Root | Element): readonly (RootContent | ElementContent)[] {
  return parent.children as readonly (RootContent | ElementContent)[]
}

/**
 * code/pre 配下の text node かを判定する。
 */
function isInsideCode(ancestorTagNames: readonly string[]): boolean {
  for (const tag of ancestorTagNames) {
    if (CODE_ELEMENT_TAG_NAMES.includes(tag)) {
      return true
    }
  }
  return false
}

/**
 * 1 つの text node から未対応記法を抽出し、`leftovers` に積む。
 *
 * text 値の中に直接残留しうる記法 (改行のみで終わる `@[name]` や `:::xxx`)
 * のみを対象にする。`@[name](url)` 形式の link は HAST 段階で element に
 * 変換されているため、本関数ではなく `collectAnchorLeftovers` 側で検知する。
 */
function collectTextLeftovers(textNode: Text, leftovers: Leftover[]): void {
  const value = textNode.value
  if (typeof value !== 'string' || value.length === 0) {
    return
  }
  collectEmbedLeftovers(value, leftovers)
  collectContainerLeftovers(value, leftovers)
}

/**
 * `@[name]` 形式のうち未対応 name を拾う。
 */
function collectEmbedLeftovers(value: string, leftovers: Leftover[]): void {
  const matches = value.matchAll(ZENN_EMBED_DIRECTIVE_PATTERN)
  for (const match of matches) {
    const name = match[1]
    if (name === undefined) {
      continue
    }
    if (SUPPORTED_EMBED_NAMES.includes(name)) {
      continue
    }
    leftovers.push({ kind: 'embed', raw: match[0], name })
  }
}

/**
 * `:::name` 形式のうち未対応 name を拾う。
 */
function collectContainerLeftovers(
  value: string,
  leftovers: Leftover[],
): void {
  const matches = value.matchAll(ZENN_CONTAINER_OPENER_PATTERN)
  for (const match of matches) {
    const name = (match[1] ?? '').trim()
    if (name.length === 0) {
      continue
    }
    if (SUPPORTED_CONTAINER_NAMES.includes(name)) {
      continue
    }
    leftovers.push({ kind: 'container', raw: match[0], name })
  }
}

/**
 * 収集した違反をまとめて人間可読なエラーメッセージに整形する。
 *
 * 形式:
 *   [rehypeAssertNoZennLeftovers] unsupported zenn syntax detected:
 *     - embed `@[card]` (name="card")
 *     - container `:::warning` (name="warning")
 */
function buildErrorMessage(leftovers: readonly Leftover[]): string {
  const lines = leftovers.map((leftover) => {
    const label = leftover.kind === 'embed' ? 'embed' : 'container'
    return `  - ${label} \`${leftover.raw}\` (name="${leftover.name}")`
  })
  return `${UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX}\n${lines.join('\n')}`
}
