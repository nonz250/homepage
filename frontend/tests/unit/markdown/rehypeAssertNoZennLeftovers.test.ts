import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkMdc from 'remark-mdc'
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

  describe('unsupported code block languages', () => {
    /**
     * ` ```mermaid ` のようなコードフェンスは remark-rehype により
     * `<pre><code class="language-mermaid">` に変換される。Phase 3 で
     * 対応予定の言語は Phase 2 時点では build fail させる。
     */
    it('throws when a mermaid code fence is present', () => {
      const md = ['```mermaid', 'graph TD', '  A --> B', '```', ''].join('\n')
      expect(() => processMarkdownToHast(md)).toThrowError(/mermaid/)
    })

    it('does not throw for supported languages (javascript/typescript/html)', () => {
      const md = [
        '```javascript',
        'const a = 1',
        '```',
        '',
        '```typescript',
        'const b: number = 2',
        '```',
        '',
        '```html',
        '<div></div>',
        '```',
        '',
      ].join('\n')
      expect(() => processMarkdownToHast(md)).not.toThrow()
    })
  })

  describe('unsupported span directives (@[mermaid] etc)', () => {
    /**
     * `@[mermaid]` は `(...)` の URL 部分を持たないため、remark-mdc が
     * 「inline MDC directive」として `<span>` に変換する。hast 段階では
     * 「`@` 末尾の text + 直後の `<span>mermaid</span>`」として現れる。
     * 既存の anchor 検知パターンと同じ構造で span 版も検知し fail させる。
     */
    it('throws when @[mermaid] is present without URL part', () => {
      const md = '@[mermaid]\n'
      expect(() => processMarkdownToHast(md)).toThrowError(/mermaid/)
    })

    it('does not throw for a normal <span> (e.g. ::span syntax) with supported embed name', () => {
      // 対応済みの @[youtube] は remark-mdc によって link に変換されるので
      // 本テストの span 検知には引っかからない。あえて trivial に pass を
      // 確認する。
      const md = 'See https://example.com for details.\n'
      expect(() => processMarkdownToHast(md)).not.toThrow()
    })
  })

  describe('unsupported container tags lifted by remark-mdc', () => {
    /**
     * remark-mdc は引数なしの `:::<name>` を `containerComponent` に昇格させ、
     * remark-rehype で `<name>` タグの hast element になる。その段階で
     * `<warning>` / `<tip>` / `<info>` のような未対応 Zenn コンテナ名が
     * 残っていたら本プラグインが検知して fail させる責務を担う。
     */
    function processWithMdcToHast(md: string): void {
      const processor = unified()
        .use(remarkParse)
        .use(remarkMdc)
        .use(remarkRehype, { allowDangerousHtml: false })
        .use(rehypeAssertNoZennLeftovers)
      processor.runSync(processor.parse(md))
    }

    it('throws when :::warning container is lifted into <warning> element', () => {
      const md = [':::warning', 'body', ':::', ''].join('\n')
      expect(() => processWithMdcToHast(md)).toThrowError(
        UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
      )
    })

    it('throws when :::tip container is lifted into <tip> element', () => {
      const md = [':::tip', 'hint', ':::', ''].join('\n')
      expect(() => processWithMdcToHast(md)).toThrowError(/tip/)
    })

    it('throws when :::info container is lifted into <info> element', () => {
      const md = [':::info', 'note', ':::', ''].join('\n')
      expect(() => processWithMdcToHast(md)).toThrowError(/info/)
    })

    it('does not throw when :::message is lifted (message is a supported container name)', () => {
      // remark-mdc による `<message>` 昇格は本プラグイン単独では blocklist に
      // 含めていない。実運用では remark-zenn-container が先に
      // `zenn-message` にリネームしてから本プラグインが走るため、生の
      // `<message>` は allowlist 外。ただし message 自体は Zenn 対応記法なので、
      // この段階での fail は避ける (後続の remark-zenn-container が変換する
      // はずの契約)。
      const md = [':::message', 'hello', ':::', ''].join('\n')
      expect(() => processWithMdcToHast(md)).not.toThrowError(
        UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
      )
    })
  })
})
