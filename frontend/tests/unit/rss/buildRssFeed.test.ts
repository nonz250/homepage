/**
 * `buildRssFeed` の単体テスト。
 *
 * 出力 XML を (1) 構造 (タグの出現)、(2) エスケープ (XML 危険文字)、
 * (3) Optional description の扱い、(4) 空配列での挙動、の 4 観点で
 * 検証する。純関数に閉じているため fixture はすべてインメモリ。
 */
import { describe, expect, it } from 'vitest'
import {
  buildRssFeed,
  escapeXmlText,
  toRfc822,
  type RssFeedItem,
} from '../../../utils/rss/buildRssFeed'

const BASE_URL = 'https://nozomi.bike'
// 2026-04-18 09:00:00 +09:00 = 2026-04-18T00:00:00.000Z
const BUILD_TIME = new Date('2026-04-18T00:00:00.000Z')

describe('escapeXmlText', () => {
  it('escapes all five XML-significant characters', () => {
    expect(escapeXmlText(`<tag attr="v" name='v' & more>`)).toBe(
      '&lt;tag attr=&quot;v&quot; name=&apos;v&apos; &amp; more&gt;',
    )
  })

  it('escapes ampersand first to avoid double escaping', () => {
    // `&` を先に置換しないと `&amp;` の `&` が再度 `&amp;amp;` になる。
    expect(escapeXmlText('&lt;')).toBe('&amp;lt;')
  })

  it('passes through plain text unchanged', () => {
    expect(escapeXmlText('hello world')).toBe('hello world')
  })
})

describe('toRfc822', () => {
  it('converts an ISO 8601 string to RFC 822 (UTC)', () => {
    // toUTCString の書式は `Sat, 18 Apr 2026 00:00:00 GMT`
    expect(toRfc822('2026-04-18T00:00:00.000Z')).toBe(
      'Sat, 18 Apr 2026 00:00:00 GMT',
    )
  })

  it('normalizes offset timestamps to UTC', () => {
    expect(toRfc822('2026-04-18T09:00:00+09:00')).toBe(
      'Sat, 18 Apr 2026 00:00:00 GMT',
    )
  })

  it('returns empty string for an unparsable value', () => {
    expect(toRfc822('not-a-date')).toBe('')
  })
})

describe('buildRssFeed', () => {
  const sampleItem: RssFeedItem = {
    slug: 'hello',
    title: 'hello world',
    publishedAt: '2026-04-18T00:00:00.000Z',
  }

  it('wraps items in a valid RSS 2.0 envelope with atom:link self reference', () => {
    const xml = buildRssFeed({
      baseUrl: BASE_URL,
      buildTime: BUILD_TIME,
      items: [sampleItem],
    })

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain(
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    )
    expect(xml).toContain('<channel>')
    expect(xml).toContain('</channel>')
    expect(xml).toContain('</rss>')
    // atom:link には self URL + MIME type + rel=self が必要。
    expect(xml).toContain(
      '<atom:link href="https://nozomi.bike/feed.xml" rel="self" type="application/rss+xml" />',
    )
    expect(xml).toContain('<language>ja</language>')
    expect(xml).toContain(
      `<lastBuildDate>${BUILD_TIME.toUTCString()}</lastBuildDate>`,
    )
  })

  it('renders items with absolute link, guid and RFC 822 pubDate', () => {
    const xml = buildRssFeed({
      baseUrl: BASE_URL,
      buildTime: BUILD_TIME,
      items: [sampleItem],
    })

    expect(xml).toContain('<item>')
    expect(xml).toContain('<title>hello world</title>')
    expect(xml).toContain('<link>https://nozomi.bike/articles/hello</link>')
    expect(xml).toContain(
      '<guid isPermaLink="true">https://nozomi.bike/articles/hello</guid>',
    )
    expect(xml).toContain('<pubDate>Sat, 18 Apr 2026 00:00:00 GMT</pubDate>')
    expect(xml).toContain('</item>')
  })

  it('escapes XML-significant characters inside titles', () => {
    const xml = buildRssFeed({
      baseUrl: BASE_URL,
      buildTime: BUILD_TIME,
      items: [
        {
          slug: 'escape',
          title: `<b>danger & "quote" 'apos'</b>`,
          publishedAt: '2026-04-18T00:00:00.000Z',
        },
      ],
    })
    // Raw `<b>` / `&` / `"` / `'` はそのままの形で埋め込まれないこと。
    expect(xml).not.toMatch(/<b>danger/)
    expect(xml).toContain(
      '<title>&lt;b&gt;danger &amp; &quot;quote&quot; &apos;apos&apos;&lt;/b&gt;</title>',
    )
  })

  it('omits <description> when item.description is not provided', () => {
    const xml = buildRssFeed({
      baseUrl: BASE_URL,
      buildTime: BUILD_TIME,
      items: [sampleItem],
    })
    // channel 側 <description> は 1 回あるが、item 側の description は未指定。
    const itemBlock = xml
      .split('<item>')
      .slice(1)
      .join('<item>')
    expect(itemBlock).not.toContain('<description>')
  })

  it('includes <description> when item.description is provided', () => {
    const xml = buildRssFeed({
      baseUrl: BASE_URL,
      buildTime: BUILD_TIME,
      items: [
        {
          ...sampleItem,
          description: 'summary',
        },
      ],
    })
    expect(xml).toContain('<description>summary</description>')
  })

  it('omits item blocks when items is empty', () => {
    const xml = buildRssFeed({
      baseUrl: BASE_URL,
      buildTime: BUILD_TIME,
      items: [],
    })
    expect(xml).not.toContain('<item>')
    // channel envelope 自体は生成される。
    expect(xml).toContain('<channel>')
    expect(xml).toContain('</channel>')
  })

  it('normalizes baseUrl trailing slash so item URLs do not double-slash', () => {
    const xml = buildRssFeed({
      baseUrl: 'https://nozomi.bike/',
      buildTime: BUILD_TIME,
      items: [sampleItem],
    })
    expect(xml).toContain('<link>https://nozomi.bike/articles/hello</link>')
    expect(xml).not.toContain('//articles/hello')
  })

  it('preserves input order for items (no internal resorting)', () => {
    const items: RssFeedItem[] = [
      {
        slug: 'second',
        title: 'Second',
        publishedAt: '2026-04-18T00:00:00.000Z',
      },
      {
        slug: 'first',
        title: 'First',
        publishedAt: '2026-04-17T00:00:00.000Z',
      },
    ]
    const xml = buildRssFeed({
      baseUrl: BASE_URL,
      buildTime: BUILD_TIME,
      items,
    })
    const firstIndex = xml.indexOf('<title>Second</title>')
    const secondIndex = xml.indexOf('<title>First</title>')
    expect(firstIndex).toBeGreaterThan(0)
    expect(secondIndex).toBeGreaterThan(firstIndex)
  })
})
