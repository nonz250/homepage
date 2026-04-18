import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeAssertNoZennLeftovers, {
  UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
} from '../../../utils/markdown/rehypeAssertNoZennLeftovers'

/**
 * `rehypeAssertNoZennLeftovers` の単体テスト。
 *
 * Markdown から unified (remark-parse → remark-rehype → 本プラグイン) で HAST を
 * 構築し、未対応 Zenn 記法が残っていれば throw、対応済み or 誤検知パターンで
 * throw しないことを確認する。
 *
 * 注意: フェーズ 2 の `remarkZennContainer` / `remarkZennEmbed` は Batch C で
 * 実装されるため、ここではそれらは通さない。対応済み記法のケースは「変換
 * 済み相当の HAST (例えば `@[youtube]` が取り除かれた状態)」ではなく、
 * 「もともと変換される前から単なる本文として扱える Markdown」で再現する。
 * これは本プラグインが「text node に残っていた場合にだけ検知する」という
 * 契約を忠実に試すためである。
 */
function processMarkdownToHast(md: string): void {
  unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeAssertNoZennLeftovers)
    .runSync(unified().use(remarkParse).parse(md))
}

describe('rehypeAssertNoZennLeftovers', () => {
  describe('pass-through cases', () => {
    it('does not throw for a plain paragraph', () => {
      expect(() => processMarkdownToHast('# Title\n\nhello world\n')).not.toThrow()
    })

    it('does not throw when supported container names appear in prose', () => {
      // 対応済みの `:::message` 等が text として残ることは実運用ではないが、
      // 文書中に「こう書けます」と説明的に現れても誤発動しないことを確認する。
      expect(() =>
        processMarkdownToHast('example: :::message text\n'),
      ).not.toThrow()
    })

    it('does not throw for ordinary Japanese text containing `@`', () => {
      // メールアドレスっぽい @ や、箇条書き中の @ はよくある。ここで誤発動
      // しないことが、誤検知を排除する上で最重要。
      expect(() =>
        processMarkdownToHast('ご連絡は user@example.com まで\n'),
      ).not.toThrow()
    })

    it('does not throw when `@[card]` appears inside a fenced code block', () => {
      // コード例中に書かれた埋め込み記法は「実行」されない想定なので無視する。
      const md = [
        'sample:',
        '',
        '```markdown',
        '@[card](https://example.com)',
        '```',
        '',
      ].join('\n')
      expect(() => processMarkdownToHast(md)).not.toThrow()
    })

    it('does not throw when `@[gist]` appears inside inline code', () => {
      expect(() =>
        processMarkdownToHast('example: `@[gist](url)` is not yet supported\n'),
      ).not.toThrow()
    })
  })

  describe('unsupported embed directives', () => {
    it('throws on `@[card](url)` leftover', () => {
      expect(() =>
        processMarkdownToHast('@[card](https://example.com)\n'),
      ).toThrowError(UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX)
    })

    it('throws on `@[tweet]` leftover', () => {
      expect(() =>
        processMarkdownToHast('see @[tweet](https://example.com)\n'),
      ).toThrowError(/tweet/)
    })

    it('throws on `@[mermaid]` leftover', () => {
      expect(() =>
        processMarkdownToHast('@[mermaid]\n'),
      ).toThrowError(/mermaid/)
    })

    it('includes the raw `@[name]` in the error message', () => {
      expect(() =>
        processMarkdownToHast('before @[gist](url) after\n'),
      ).toThrowError(/@\[gist\]/)
    })
  })

  describe('unsupported container openers', () => {
    it('throws when a paragraph contains `:::warning` at line start', () => {
      const md = [
        ':::warning',
        'this is a custom container that is not supported yet',
        ':::',
        '',
      ].join('\n')
      expect(() => processMarkdownToHast(md)).toThrowError(
        UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
      )
    })

    it('throws on unknown `:::unsupported` container', () => {
      const md = [':::unsupported', 'body', ':::', ''].join('\n')
      expect(() => processMarkdownToHast(md)).toThrowError(/unsupported/)
    })
  })

  describe('mixed cases', () => {
    it('collects multiple leftovers in a single error message', () => {
      const md = [
        'intro',
        '',
        '@[card](https://example.com)',
        '',
        ':::warning',
        'body',
        ':::',
        '',
      ].join('\n')
      const attempt = () => processMarkdownToHast(md)
      expect(attempt).toThrowError(/@\[card\]/)
      expect(attempt).toThrowError(/warning/)
    })
  })
})
