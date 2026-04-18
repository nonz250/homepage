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
    it('does not throw on `@[card](url)` (supported since Phase 3 Batch B)', () => {
      // `card` は remark-zenn-card が処理して containerComponent に変換する
      // 想定だが、万一素通しされて hast に link として残ったとしても、本
      // プラグインの SUPPORTED_EMBED_NAMES に含まれているため build fail に
      // はしない (= remark-zenn-card が走らないテストパイプラインでは leftover
      // として扱わない)。
      expect(() =>
        processMarkdownToHast('@[card](https://example.com)\n'),
      ).not.toThrow()
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
    it('throws only on unsupported names when mixed with supported card', () => {
      // `@[card]` は Phase 3 Batch B で許可済み、`@[tweet]` は未対応のまま。
      // 混在時は tweet のみ throw 理由に含まれること。
      const md = [
        'intro',
        '',
        '@[card](https://example.com)',
        '',
        '@[tweet](https://example.com/status/1)',
        '',
        ':::warning',
        'body',
        ':::',
        '',
      ].join('\n')
      const attempt = () => processMarkdownToHast(md)
      expect(attempt).toThrowError(/@\[tweet\]/)
      expect(attempt).toThrowError(/warning/)
    })
  })

  describe('code block languages (mermaid now supported via remarkZennMermaid)', () => {
    /**
     * Phase 3 Batch C1 以降、 ```mermaid コードフェンスは `remarkZennMermaid`
     * が `<zenn-mermaid>` MDC コンポーネントに変換する。本プラグインが単独で
     * 走る (= remark-zenn-mermaid を通さない) このテストでは、`<code
     * class="language-mermaid">` が残存していても throw しない契約にする。
     *
     * 背景: `UNSUPPORTED_CODE_LANGUAGES` を空集合に戻したため、language 指定
     * 起因の fail は発生しない。`@[mermaid]` inline directive の残留検知は
     * 別に維持している (`unsupported span directives` ブロック参照)。
     */
    it('does not throw when a mermaid code fence is present (handled by remarkZennMermaid upstream)', () => {
      const md = ['```mermaid', 'graph TD', '  A --> B', '```', ''].join('\n')
      expect(() => processMarkdownToHast(md)).not.toThrow()
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

  describe('zenn-embed-card is listed in KNOWN_MDC_RESULT_TAGS', () => {
    /**
     * remarkZennCard が生成する `containerComponent(name="zenn-embed-card")` は
     * rehype 段階で `<zenn-embed-card>` element になる。本プラグインの
     * allowlist に含まれていれば throw しないことを確認する。
     */
    it('does not throw for a <zenn-embed-card> element', () => {
      // 直接 hast を組む代わりに、remark-mdc の element 昇格を利用する。
      // `:::zenn-embed-card\n:::` は remark-mdc が `<zenn-embed-card>` element
      // として hast に出力するため、allowlist 判定の動作確認ができる。
      const md = [':::zenn-embed-card', ':::', ''].join('\n')
      const processor = unified()
        .use(remarkParse)
        .use(remarkMdc)
        .use(remarkRehype, { allowDangerousHtml: false })
        .use(rehypeAssertNoZennLeftovers)
      expect(() => processor.runSync(processor.parse(md))).not.toThrow()
    })
  })

  describe('zenn-mermaid is listed in KNOWN_MDC_RESULT_TAGS', () => {
    /**
     * Phase 3 Batch C1 で追加した `<zenn-mermaid>` タグが allowlist に
     * 含まれていることを確認するための回帰テスト。`:::zenn-mermaid\n:::`
     * を remark-mdc 経由で hast element に昇格させ、throw されないことを
     * 検証する。
     */
    it('does not throw for a <zenn-mermaid> element', () => {
      const md = [':::zenn-mermaid', ':::', ''].join('\n')
      const processor = unified()
        .use(remarkParse)
        .use(remarkMdc)
        .use(remarkRehype, { allowDangerousHtml: false })
        .use(rehypeAssertNoZennLeftovers)
      expect(() => processor.runSync(processor.parse(md))).not.toThrow()
    })
  })
})
