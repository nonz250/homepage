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
 * remark-mdc が昇格させた hast `<tag>` のうち、ビルドを通す「既知」タグ名の
 * 集合。
 *
 * Zenn MDC コンポーネント (`zenn-*`) と、`details` のような HTML5 標準タグで
 * Zenn コンテナ由来になり得る要素名を列挙する。この集合に含まれない
 * カスタム風タグ (`<warning>`, `<info>`, `<tip>` 等) は、remark-mdc が
 * 昇格させた未対応 Zenn コンテナ名である可能性が高く、静かな記事壊れを
 * 防ぐため fail させる。
 */
const KNOWN_MDC_RESULT_TAGS: ReadonlySet<string> = new Set([
  // Zenn 専用 MDC コンポーネント (remark-zenn-container / remark-zenn-embed /
  // remark-zenn-card / remark-zenn-mermaid が生成する kebab-case タグ名)。
  'zenn-message',
  'zenn-details',
  'zenn-embed-you-tube',
  'zenn-embed-code-pen',
  'zenn-embed-code-sandbox',
  'zenn-embed-stack-blitz',
  'zenn-embed-card',
  'zenn-mermaid',
])

/**
 * 未対応と明示的に扱う hast `<tag>` 名の集合。
 *
 * `@nuxtjs/mdc` が remark-mdc から昇格させる未対応コンテナ名のうち、Zenn
 * 互換で想定される記法 (`:::warning`, `:::tip`, `:::info`) をここで列挙する。
 * blocklist と allowlist (`KNOWN_MDC_RESULT_TAGS`) の両方を持つのは、
 * HTML5 タグ (`<section>` 等) を誤検知しないための安全装置。
 */
const UNSUPPORTED_MDC_TAGS: ReadonlySet<string> = new Set([
  'warning',
  'tip',
  'info',
])

/**
 * ビルドを fail させるコードブロック言語名 (`<code class="language-<name>">` の
 * `<name>` 部分)。
 *
 * Phase 3 Batch C1 で ` ```mermaid ` は `remarkZennMermaid` が
 * `<zenn-mermaid>` MDC コンポーネントに変換するようになった。本プラグインが
 * 走る時点で `<code class="language-mermaid">` が残っていることはなく、
 * 変換が欠落した場合の safety net としては element allowlist
 * (`KNOWN_MDC_RESULT_TAGS`) の方が確実に機能する。
 *
 * 現時点で build fail させたい language 指定は無いため空集合にしている。
 * 将来、サポート外の重要な言語 (例: 独自 DSL) を検知したくなった場合は
 * 要素を追加する。
 */
const UNSUPPORTED_CODE_LANGUAGES: ReadonlySet<string> = new Set<string>()

/**
 * `<code>` 要素の className から `language-*` 指定を取り出すための接頭辞。
 */
const CODE_LANGUAGE_CLASS_PREFIX = 'language-'

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
 * フェーズ 2 以降で対応済みの `@[name]` 記法 (埋め込み系)。これに該当しない
 * name を持つ `@[xxx]` が本 rehype プラグインの時点で残っていたら build fail。
 *
 * - `youtube` / `codepen` / `codesandbox` / `stackblitz`: Phase 2 で対応
 *   (`remarkZennEmbed`)
 * - `card`: Phase 3 Batch B で対応 (`remarkZennCard`)。変換失敗した場合も
 *   fallback card に落とすため、ここに到達する時点で何かが壊れている扱い。
 *
 * 注意: これらの name は remark プラグインが処理すると HAST に link として
 * 残らないはずなので、ここに来る時点で未変換 = 失敗扱い。
 */
const SUPPORTED_EMBED_NAMES: readonly string[] = Object.freeze([
  'youtube',
  'codepen',
  'codesandbox',
  'stackblitz',
  'card',
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
  readonly kind: 'embed' | 'container' | 'element' | 'code'
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
  // element の段階で「自身が未対応の language 指定コードブロック」かを
  // 先にチェックする。`<code class="language-mermaid">` のように祖先が
  // `<code>` で無くても自身がコードである場合、さらに code 中の text を
  // 走査しても意味がないため、検知後は子要素の走査を打ち切る。
  if (node.type === 'element') {
    const element = node as Element
    const codeLang = extractUnsupportedCodeLanguage(element)
    if (codeLang !== null) {
      leftovers.push({
        kind: 'code',
        raw: `\`\`\`${codeLang}`,
        name: codeLang,
      })
      return
    }
  }
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
      collectUnknownElementLeftovers(parentNode as Element, leftovers)
      collectSpanDirectiveLeftovers(parentNode as Element, leftovers)
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
 * element が `<code class="language-<unsupported>">` の形をしていれば、
 * その言語名を返す。それ以外は null。
 *
 * remark-mdc は `<pre><code class="language-xxx">` のネストを生成するため、
 * `<code>` 本体を検査する。rehype-highlight 等が別のクラス体系に変換する
 * 前提では作動しないが、本プロジェクトはハイライト処理を経由していないため
 * 素の `language-xxx` 接頭辞で十分。
 */
function extractUnsupportedCodeLanguage(element: Element): string | null {
  if (element.tagName !== 'code') {
    return null
  }
  const rawClassName = element.properties?.className
  const classList = normalizeClassName(rawClassName)
  for (const cls of classList) {
    if (!cls.startsWith(CODE_LANGUAGE_CLASS_PREFIX)) {
      continue
    }
    const lang = cls.slice(CODE_LANGUAGE_CLASS_PREFIX.length)
    if (UNSUPPORTED_CODE_LANGUAGES.has(lang)) {
      return lang
    }
  }
  return null
}

/**
 * hast の `Element.properties.className` は string | string[] | boolean | ...
 * の union になりうる。走査しやすい string[] に正規化する。
 */
function normalizeClassName(
  raw: Element['properties'] extends Record<string, infer V> ? V : unknown,
): readonly string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string')
  }
  if (typeof raw === 'string') {
    return raw.split(/\s+/).filter((item) => item.length > 0)
  }
  return []
}

/**
 * `@[name]` が remark-mdc により inline textComponent に変換されたケースを
 * 検知する。hast 上は「直前 text が `@` で終わり、次の `<span>` 内部 text が
 * 未対応 name」という形で現れる。
 *
 * 特に `@[mermaid]` は URL 部分を持たないため、anchor パターンではなく
 * span パターンで検知する。
 */
function collectSpanDirectiveLeftovers(
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
    if ((current as Element).tagName !== 'span') {
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
 * element の tagName が `UNSUPPORTED_MDC_TAGS` blocklist に含まれる場合、
 * 未対応コンテナとして検知する。
 *
 * `KNOWN_MDC_RESULT_TAGS` allowlist と `UNSUPPORTED_MDC_TAGS` blocklist を
 * 組み合わせ、HTML5 標準タグ (`<section>` 等) の誤検知を避けつつ、Zenn
 * 由来の未対応コンテナ名 (`:::warning`, `:::tip` 等) を確実に拾う。
 */
function collectUnknownElementLeftovers(
  element: Element,
  leftovers: Leftover[],
): void {
  const tag = element.tagName
  if (KNOWN_MDC_RESULT_TAGS.has(tag)) {
    return
  }
  if (UNSUPPORTED_MDC_TAGS.has(tag)) {
    leftovers.push({ kind: 'element', raw: `<${tag}>`, name: tag })
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
    const label = leftoverKindLabel(leftover.kind)
    return `  - ${label} \`${leftover.raw}\` (name="${leftover.name}")`
  })
  return `${UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX}\n${lines.join('\n')}`
}

/**
 * Leftover.kind を人間可読なラベルに変換する。
 */
function leftoverKindLabel(kind: Leftover['kind']): string {
  switch (kind) {
    case 'embed':
      return 'embed'
    case 'container':
      return 'container'
    case 'element':
      return 'element'
    case 'code':
      return 'code'
  }
}
