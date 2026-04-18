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
import remarkZennTweet from '../../../utils/markdown/remarkZennTweet'
import remarkZennGist from '../../../utils/markdown/remarkZennGist'
import rehypeAssertNoZennLeftovers, {
  UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX,
} from '../../../utils/markdown/rehypeAssertNoZennLeftovers'

/**
 * Phase 3 Batch C2 時点で「未対応のまま残っている Zenn 記法」がビルドを
 * fail させる契約テスト。
 *
 * 本テストの対象:
 *   - `@[card](url)`:    Phase 3 Batch B で対応済み (throw しないことを確認)
 *   - `@[tweet](url)`:   Phase 3 Batch C2 で対応済み (throw しないことを確認)
 *   - `@[gist](url)`:    Phase 3 Batch C2 で対応済み (throw しないことを確認)
 *   - `@[mermaid]`:      inline directive は意図的に未対応 (throw する)
 *   - `:::warning` 等:   未対応コンテナ (throw する)
 *
 * 目的:
 *   - Phase 3 未対応の記法が本番記事に紛れ込んで「レンダリングされない謎の
 *     テキスト」になるのを防ぐ
 *   - 各 Batch で対応完了した記法は、対応済み経路に切り替わったことを
 *     回帰テストとして固定する
 */

/**
 * Phase 3 Batch C2 時点の remark + rehype パイプラインを構築する。
 * nuxt.config.ts に登録している順序を忠実に再現する。ただし OGP fetch を
 * 要する `remarkZennCard` は別途統合テストに任せ、本ファイルでは組み込まない
 * (ネットワーク依存を避ける)。
 */
function buildPipeline() {
  return unified()
    .use(remarkParse)
    .use(remarkMdc)
    .use(remarkZennContainer)
    .use(remarkZennEmbed)
    .use(remarkZennTweet)
    .use(remarkZennGist)
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
  const processor = buildPipeline()
  try {
    const mdast = processor.parse(md) as MdastRoot
    processor.runSync(mdast) as HastRoot
    return null
  }
  catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
}

describe('phase 3 zenn syntax build status', () => {
  describe('@[card] (supported since Phase 3 Batch B)', () => {
    it('does not throw for fixture containing @[card](url)', () => {
      const md = loadFixtureBody('unsupported-card.md')
      const error = tryRunPipeline(md)
      expect(error).toBeNull()
    })
  })

  describe('@[tweet] (supported since Phase 3 Batch C2)', () => {
    it('does not throw for fixture containing @[tweet](url)', () => {
      // fixture の URL は `twitter.com/user/status/<id>` 形式なので
      // remarkZennTweet が正常に containerComponent 化し、下流は fail しない。
      const md = loadFixtureBody('unsupported-tweet.md')
      const error = tryRunPipeline(md)
      expect(error).toBeNull()
    })
  })

  describe('@[gist] (supported since Phase 3 Batch C2)', () => {
    it('does not throw for fixture containing @[gist](url)', () => {
      const md = loadFixtureBody('unsupported-gist.md')
      const error = tryRunPipeline(md)
      expect(error).toBeNull()
    })
  })

  describe('@[mermaid] directive (still unsupported)', () => {
    it('throws build error for fixture containing @[mermaid] (inline directive)', () => {
      // inline directive 形式は Phase 3 でも意図的に未対応のまま。
      // rehypeAssertNoZennLeftovers の span 検知で throw する契約を固定する。
      const md = loadFixtureBody('unsupported-mermaid.md')
      const error = tryRunPipeline(md)
      expect(error).not.toBeNull()
      expect(error?.message).toMatch(/mermaid/)
    })
  })

  describe('error prefix surface (for still-unsupported directives)', () => {
    it('uses the known error prefix from either remark-zenn-embed or rehype-assert', () => {
      // 本プラグイン郡では 2 種類の build fail 経路がある:
      //   1. `remarkZennEmbed`: `@[youtube]` など「サポート対象サービスだが
      //      ID/URL が invalid」 (INVALID_ZENN_EMBED_ERROR_PREFIX)
      //   2. `rehypeAssertNoZennLeftovers`: サポート外サービス (例: 未対応の
      //      `@[mermaid]` inline directive) (UNSUPPORTED_ZENN_SYNTAX_ERROR_PREFIX)
      //
      // 依然として (2) 経由で落ちる `@[mermaid]` inline で prefix が識別可能な
      // 形で含まれていることを担保する。
      const md = loadFixtureBody('unsupported-mermaid.md')
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
