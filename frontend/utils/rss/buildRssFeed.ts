/**
 * RSS 2.0 フィード XML を組み立てる純関数。
 *
 * 入力は記事配列とサイトメタ (baseUrl / title / description) のみで、
 * I/O やグローバル状態への参照を持たない。ファイル読み込みや HTTP
 * 応答送出は呼び出し側 (Nitro server handler) の責務とし、本関数は
 * テスト可能な純粋計算に閉じ込める。
 *
 * 出力仕様:
 *   - `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`
 *   - `<channel>` に `<title>` `<link>` `<description>` `<language>`
 *     `<atom:link rel="self" type="application/rss+xml">` `<lastBuildDate>`
 *   - 各 `<item>` に `<title>` `<link>` `<guid isPermaLink="true">`
 *     `<pubDate>` (RFC 822) と (任意で) `<description>`
 *
 * XML エスケープ:
 *   - `<`, `>`, `&`, `"`, `'` の 5 文字を手動で置換
 *   - 外部依存を増やさずにセキュリティ境界を自前で保証する
 */
import {
  RSS_FEED_PATH,
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_TITLE,
} from '../../constants/rss'

/**
 * RSS フィード 1 件分のアイテム。
 *
 * `slug` は `/articles/<slug>` へのマッピングに使う (channel link の
 * 相対パスと合成)。`description` は optional (frontmatter に本文の
 * 概要を持たないため、hello 運用では未指定で `<description>` を
 * 省略しても構わない)。
 */
export interface RssFeedItem {
  readonly slug: string
  readonly title: string
  /** ISO 8601 の公開日時 (`published_at`) */
  readonly publishedAt: string
  /** 本文抜粋 (optional、未指定なら <description> を省略) */
  readonly description?: string
}

/**
 * `buildRssFeed` の引数。
 *
 * baseUrl は末尾スラッシュなしで受け取り、内部で自前に正規化する。
 * feedPath / itemLinkPrefix は設計文書上は固定値だが、テスタビリティ
 * のため optional の override として受け取る (デフォルト値は定数を使用)。
 */
export interface BuildRssFeedInput {
  /** ex. `"https://nozomi.bike"` (末尾スラッシュなし) */
  readonly baseUrl: string
  /** ビルド時刻 (`<lastBuildDate>` に採用) */
  readonly buildTime: Date
  /** 記事アイテム (呼び出し側で公開判定 + ソート済みを前提とする) */
  readonly items: readonly RssFeedItem[]
  /** `<channel><title>` (未指定なら SITE_TITLE) */
  readonly siteTitle?: string
  /** `<channel><description>` (未指定なら SITE_DESCRIPTION) */
  readonly siteDescription?: string
  /** `<channel><language>` (未指定なら SITE_LANGUAGE) */
  readonly siteLanguage?: string
  /** フィード自身のパス (未指定なら RSS_FEED_PATH) */
  readonly feedPath?: string
  /** 記事 URL の prefix (未指定なら `/articles/`) */
  readonly itemLinkPrefix?: string
}

/** 記事 URL のデフォルト prefix */
const DEFAULT_ITEM_LINK_PREFIX = '/articles/'

/** XML 宣言 (`<?xml ... ?>`) 行 */
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'

/** RSS 2.0 + atom:link の XML 名前空間宣言つき開始タグ */
const RSS_OPEN_TAG =
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">'

/** RSS 閉じタグ */
const RSS_CLOSE_TAG = '</rss>'

/**
 * XML テキスト用のエスケープ。
 *
 * RSS / XML 1.0 の仕様で解釈されてしまう 5 文字
 * (`<`, `>`, `&`, `"`, `'`) を参照文字に変換する。attribute 値と
 * テキストノードの双方で安全に利用できる。
 *
 * - Unicode 制御文字や surrogate pair の正規化は行わない。frontmatter
 *   (gray-matter) / Nuxt Content (zod schema) の両方が入力境界で
 *   サニタイズしている前提で、本関数は純粋なエスケープに限定する。
 * - `&` は最初に置換しないと二重エスケープになる点に注意。
 */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * ISO 8601 → RFC 822 (`<pubDate>` 用) に変換する。
 *
 * `Date.prototype.toUTCString` は RFC 7231 形式 (`Sun, 06 Nov 1994
 * 08:49:37 GMT`) で、RFC 822 / RFC 1123 と互換がある。フィード
 * リーダー互換性の観点で UTC 基準に正規化する (元の timezone
 * offset は捨てるが、絶対時刻は保存される)。
 *
 * 不正な日時文字列 (`Date.parse` が NaN) は呼び出し側で弾く想定。
 * ここでは fail-closed で空文字を返す。
 */
export function toRfc822(isoString: string): string {
  const ms = Date.parse(isoString)
  if (Number.isNaN(ms)) {
    return ''
  }
  return new Date(ms).toUTCString()
}

/**
 * 末尾スラッシュを除去して baseUrl を正規化する。
 *
 * 呼び出し側がうっかり `https://example.com/` のように trailing slash
 * 付きで渡してきても、最終 URL が `//articles/slug` のように二重に
 * ならないようにする防御。
 */
function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * RSS 2.0 フィード XML を文字列として生成する。
 *
 * 入力順を維持したまま `<item>` を書き出す。呼び出し側 (server
 * handler) で公開判定 + `published_at` 降順ソートを済ませた配列を
 * 渡すこと (設計仕様)。
 *
 * 出力は改行区切りの 1 枚の文字列で、HTTP レスポンスボディとして
 * そのまま返せる。
 */
export function buildRssFeed(input: BuildRssFeedInput): string {
  const baseUrl = stripTrailingSlash(input.baseUrl)
  const feedPath = input.feedPath ?? RSS_FEED_PATH
  const itemLinkPrefix = input.itemLinkPrefix ?? DEFAULT_ITEM_LINK_PREFIX
  const siteTitle = input.siteTitle ?? SITE_TITLE
  const siteDescription = input.siteDescription ?? SITE_DESCRIPTION
  const siteLanguage = input.siteLanguage ?? SITE_LANGUAGE

  const channelLink = `${baseUrl}/`
  const selfUrl = `${baseUrl}${feedPath}`
  const lastBuildDate = input.buildTime.toUTCString()

  const channelHead = [
    `<title>${escapeXmlText(siteTitle)}</title>`,
    `<link>${escapeXmlText(channelLink)}</link>`,
    `<description>${escapeXmlText(siteDescription)}</description>`,
    `<language>${escapeXmlText(siteLanguage)}</language>`,
    `<atom:link href="${escapeXmlText(
      selfUrl,
    )}" rel="self" type="application/rss+xml" />`,
    `<lastBuildDate>${escapeXmlText(lastBuildDate)}</lastBuildDate>`,
  ].join('\n')

  const items = input.items.map((item) =>
    renderItem(item, { baseUrl, itemLinkPrefix }),
  )

  return [
    XML_DECLARATION,
    RSS_OPEN_TAG,
    '<channel>',
    channelHead,
    ...items,
    '</channel>',
    RSS_CLOSE_TAG,
  ].join('\n')
}

/**
 * `<item>` 1 件のレンダリング。
 *
 * `<guid isPermaLink="true">` は記事の絶対 URL に一致させ、
 * `<link>` と同一値を使う (RSS 2.0 仕様で推奨される形)。
 * description が未指定なら `<description>` 要素ごと省略する。
 */
function renderItem(
  item: RssFeedItem,
  opts: { readonly baseUrl: string; readonly itemLinkPrefix: string },
): string {
  const link = `${opts.baseUrl}${opts.itemLinkPrefix}${item.slug}`
  const lines: string[] = [
    '<item>',
    `<title>${escapeXmlText(item.title)}</title>`,
    `<link>${escapeXmlText(link)}</link>`,
    `<guid isPermaLink="true">${escapeXmlText(link)}</guid>`,
    `<pubDate>${escapeXmlText(toRfc822(item.publishedAt))}</pubDate>`,
  ]
  if (typeof item.description === 'string' && item.description !== '') {
    lines.push(`<description>${escapeXmlText(item.description)}</description>`)
  }
  lines.push('</item>')
  return lines.join('\n')
}
