import { describe, expect, it } from 'vitest'
import { processMarkdownWith, readFixture } from '../../../helpers/processMarkdown'
import { transformCard } from '../../../../scripts/lib/syntax/transforms/transformCard'

describe('transformCard', () => {
  it('replaces @[service](url) with a bare URL block (golden)', () => {
    const { input, expected } = readFixture('card')
    const result = processMarkdownWith(input, transformCard)
    expect(result).toBe(expected)
  })

  it('keeps a paragraph with no embed untouched', () => {
    const input = 'ただの段落。\n'
    const output = processMarkdownWith(input, transformCard)
    expect(output).toContain('ただの段落。')
    // bare URL 化などは発生しない
    expect(output).not.toMatch(/^https:\/\//m)
  })

  it('handles multiple embeds in a single paragraph by splitting', () => {
    const input = '@[card](https://a.example) @[card](https://b.example)\n'
    const output = processMarkdownWith(input, transformCard)
    expect(output).toContain('https://a.example')
    expect(output).toContain('https://b.example')
    expect(output).not.toContain('@[card]')
  })

  it('does not transform unsupported services (e.g. slideshare)', () => {
    // rejectUnsupportedZennSyntax の責務なので、本 transform では触らない
    // (結果として @[slideshare] は link + text として残る)
    const input = '@[slideshare](https://slideshare.net/foo)\n'
    const output = processMarkdownWith(input, transformCard)
    expect(output).toContain('slideshare')
  })

  it('supports all 8 embed services: card/tweet/youtube/gist/codepen/codesandbox/stackblitz/jsfiddle', () => {
    const services = [
      ['card', 'https://github.com/a/b'],
      ['tweet', 'https://twitter.com/u/status/1'],
      ['youtube', 'dQw4w9WgXcQ'],
      ['gist', 'https://gist.github.com/u/1'],
      ['codepen', 'https://codepen.io/u/pen/abc'],
      ['codesandbox', 'abc123'],
      ['stackblitz', 'https://stackblitz.com/edit/abc'],
      ['jsfiddle', 'https://jsfiddle.net/abc/1'],
    ] as const
    for (const [service, value] of services) {
      const input = `@[${service}](${value})\n`
      const output = processMarkdownWith(input, transformCard)
      expect(output).toContain(value)
      expect(output).not.toContain(`@[${service}]`)
    }
  })

  it('is idempotent when run twice (already bare URLs stay put)', () => {
    const { input } = readFixture('card')
    const once = processMarkdownWith(input, transformCard)
    const twice = processMarkdownWith(once, transformCard)
    expect(twice).toBe(once)
  })
})
