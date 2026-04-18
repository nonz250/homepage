import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdc from 'remark-mdc'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import type { Root as MdastRoot } from 'mdast'
import type { Root as HastRoot } from 'hast'
import remarkZennImage from '../../../utils/markdown/remarkZennImage'
import remarkZennContainer from '../../../utils/markdown/remarkZennContainer'
import remarkZennEmbed, {
  INVALID_ZENN_EMBED_ERROR_PREFIX,
} from '../../../utils/markdown/remarkZennEmbed'
import rehypeAssertNoZennLeftovers, {
  UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
} from '../../../utils/markdown/rehypeAssertNoZennLeftovers'

/**
 * Phase 3 対応予定の Zenn 記法が Phase 2 時点ではビルドを fail させる
 * 契約テスト。
 *
 * 対象記法:
 *   - `@[card](url)`:    ページリンクカード (Phase 3)
 *   - `@[tweet](url)`:   X/Twitter 埋め込み (Phase 3)
 *   - `@[gist](url)`:    GitHub Gist 埋め込み (Phase 3)
 *   - `@[mermaid]`:      mermaid 図 (Phase 3)
 *   - ` ```mermaid `:    mermaid code fence (Phase 3)
 *
 * 目的:
 *   - Phase 3 スコープに含まれる機能がフェーズ中途半端で漏れると、
 *     本番記事で「レンダリングされない謎のテキスト」が静かに出てしまう
 *   - 本テストは fixture md を pipeline に流し、Phase 2 時点では
 *     確実に throw されることを保証する
 *   - Phase 3 でこれらの機能を追加した時、本テストは意図的に更新する
 *     (fixture を移動する or 対応済みとして削除) 契約として機能する
 */

/**
 * Phase 2 時点の remark + rehype パイプラインを構築する。
 * nuxt.config.ts に登録している順序を忠実に再現し、実ビルドと同じ
 * 挙動で fail するかを検証する。
 */
function buildPhase2Pipeline() {
  return unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennContainer)
    .use(remarkZennEmbed)
    .use(remarkZennImage)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeAssertNoZennLeftovers)
}

/**
 * fixture ファイルを読み込んで Markdown 本文 (frontmatter を除く) を返す。
 *
 * 本プロジェクトの Nuxt Content は frontmatter を自動で剥がすが、ここでは
 * unified + remark-mdc 単独で走らせるため、手で `---\n...\n---\n` 部分を
 * 剥がしてから pipeline に流す。
 */
function loadFixtureBody(fileName: string): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const fixturePath = resolve(
    __dirname,
    '../../fixtures/zenn-syntax',
    fileName,
  )
  const raw = readFileSync(fixturePath, 'utf-8')
  return raw.replace(/^---[\s\S]*?---\n?/, '')
}

/**
 * pipeline を実行し、throw した場合は Error を返す (throw せず)。
 */
function tryRunPipeline(md: string): Error | null {
  const processor = buildPhase2Pipeline()
  try {
    const mdast = processor.parse(md) as MdastRoot
    processor.runSync(mdast) as HastRoot
    return null
  }
  catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
}

describe('phase 3 zenn syntax fails build in phase 2', () => {
  describe('@[card]', () => {
    it('throws build error for fixture containing @[card](url)', () => {
      const md = loadFixtureBody('unsupported-card.md')
      const error = tryRunPipeline(md)
      expect(error).not.toBeNull()
      expect(error?.message).toMatch(/card/)
    })
  })

  describe('@[tweet]', () => {
    it('throws build error for fixture containing @[tweet](url)', () => {
      const md = loadFixtureBody('unsupported-tweet.md')
      const error = tryRunPipeline(md)
      expect(error).not.toBeNull()
      expect(error?.message).toMatch(/tweet/)
    })
  })

  describe('@[gist]', () => {
    it('throws build error for fixture containing @[gist](url)', () => {
      const md = loadFixtureBody('unsupported-gist.md')
      const error = tryRunPipeline(md)
      expect(error).not.toBeNull()
      expect(error?.message).toMatch(/gist/)
    })
  })

  describe('@[mermaid] directive', () => {
    it('throws build error for fixture containing @[mermaid] (fails before mermaid code fence)', () => {
      const md = loadFixtureBody('unsupported-mermaid.md')
      const error = tryRunPipeline(md)
      expect(error).not.toBeNull()
      expect(error?.message).toMatch(/mermaid/)
    })
  })

  describe('error prefix surface', () => {
    it('uses the known error prefix from either remark-zenn-embed or rehype-assert', () => {
      // 本プラグイン郡では 2 種類の build fail 経路がある:
      //   1. `remarkZennEmbed`: `@[youtube]` など「サポート対象サービスだが
      //      ID/URL が invalid」 (INVALID_ZENN_EMBED_ERROR_PREFIX)
      //   2. `rehypeAssertNoZennLeftovers`: サポート外サービス `@[card]` など
      //      (UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX)
      //
      // Phase 3 相当の `@[card]` は (2) 経由で落ちるべきで、メッセージ prefix
      // が識別可能な形で含まれていることを担保する。
      const md = loadFixtureBody('unsupported-card.md')
      const error = tryRunPipeline(md)
      expect(error).not.toBeNull()
      expect([
        INVALID_ZENN_EMBED_ERROR_PREFIX,
        UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
      ]).toContain(
        error?.message.startsWith(INVALID_ZENN_EMBED_ERROR_PREFIX)
          ? INVALID_ZENN_EMBED_ERROR_PREFIX
          : UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
      )
    })
  })
})
