import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import {
  UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
  rejectUnsupportedZennSyntax,
} from '../../../scripts/lib/syntax/rejectUnsupportedZennSyntax'
import { UNSUPPORTED_ZENN_EMBED_NAMES } from '../../../scripts/lib/constants'

function runReject(input: string): void {
  const tree = unified().use(remarkParse).parse(input)
  rejectUnsupportedZennSyntax(tree)
}

describe('rejectUnsupportedZennSyntax', () => {
  for (const name of UNSUPPORTED_ZENN_EMBED_NAMES) {
    it(`throws on @[${name}](...)`, () => {
      const input = `前置き。\n\n@[${name}](https://example.com/x)\n`
      expect(() => runReject(input)).toThrowError(
        UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
      )
    })
  }

  it('includes the line number and directive name in the error message', () => {
    const input = [
      'line 1', // 1
      '',       // 2
      'line 3', // 3
      '',       // 4
      '@[figma](https://figma.com/file/abc)', // 5
      '',       // 6
    ].join('\n')
    try {
      runReject(input)
      throw new Error('expected to throw, did not')
    }
    catch (e) {
      const message = (e as Error).message
      expect(message).toContain('@[figma]')
      expect(message).toMatch(/line 5/)
    }
  })

  it('does not throw on supported embeds (card / tweet / youtube)', () => {
    expect(() => runReject('@[card](https://github.com/a/b)\n')).not.toThrow()
    expect(() => runReject('@[tweet](https://twitter.com/a/status/1)\n')).not.toThrow()
    expect(() => runReject('@[youtube](dQw4w9WgXcQ)\n')).not.toThrow()
  })

  it('does not throw on regular link syntax', () => {
    expect(() => runReject('[text](https://slideshare.net/foo)\n')).not.toThrow()
  })

  it('does not throw when the word "slideshare" appears in prose', () => {
    expect(() => runReject('slideshare は Qiita では動かない。\n')).not.toThrow()
  })
})
