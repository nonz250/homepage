import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Slack の Link Expanding は `Range: bytes=0-N` で head の先頭しか fetch しない
 * ため、og:image をはじめとする unfurl 必須 meta が「先頭 8KB 以内」かつ
 * 「最初の `<style>` より前」に出ていることをジェネレート済み HTML に対して
 * 直接検証する。記事ページの head 順序が崩れて Slack 上のカード表示が
 * 戻ってしまう回帰を防ぐ目的。
 *
 * `npm run generate` の産物 (`.output/public/...`) が存在しない環境
 * (CI の generate 未実行ジョブ / `npm run test:integration` だけ叩いた状態)
 * では assertion を回せないため、ファイルが無い場合は describe 自体を
 * skip する。CI 上は `generate` job 内で本テストを明示的に走らせる。
 */

const REPO_ROOT_FROM_THIS_FILE = '../../..'
const GENERATED_HTML_PATH = resolve(
  __dirname,
  REPO_ROOT_FROM_THIS_FILE,
  '.output/public/articles/2026-04-19-ai-rotom-tech/index.html',
)

// Slack Link Expanding が一度に取りに行く head 先頭のサイズ。実測値ではなく
// 「この範囲に必須メタが収まっていれば Slack の unfurl が成立する」と判定
// するための上限値。8KB を超えた瞬間にカードが出なくなる兆候を検知する。
const SLACK_UNFURL_HEAD_BUDGET_BYTES = 8 * 1024

// 必須 OGP meta タグの substring。Slack / Twitter / 一般 OG クローラが
// unfurl 判定に使うコアセットに限定する。補助メタ (og:image:width 等) は
// 末尾でも構わないため対象外。
const CRITICAL_META_FRAGMENTS = [
  'property="og:title"',
  'property="og:image"',
  'property="og:description"',
  'property="og:url"',
  'property="og:type"',
  'name="twitter:image"',
  'name="description"',
] as const

// 本テストはローカル開発時の `npm run test:integration` でも壊れずに走らせ
// たいため、generate 産物が無い環境では skip する。CI 側は generate job
// 内で必ず本テストを呼び出すため、回帰検知漏れは起きない。
const generatedHtmlExists = existsSync(GENERATED_HTML_PATH)

describe.skipIf(!generatedHtmlExists)(
  'article page slack unfurl head order (integration)',
  () => {
    const html = generatedHtmlExists
      ? readFileSync(GENERATED_HTML_PATH, 'utf-8')
      : ''
    const headEndIndex = html.indexOf('</head>')
    const head = html.slice(0, headEndIndex)
    const firstStyleIndex = head.indexOf('<style')

    it('places og:image before the first <style> tag', () => {
      const ogImageIndex = head.indexOf('property="og:image"')
      expect(ogImageIndex).toBeGreaterThanOrEqual(0)
      expect(firstStyleIndex).toBeGreaterThanOrEqual(0)
      expect(ogImageIndex).toBeLessThan(firstStyleIndex)
    })

    it('places every critical OGP meta tag before the first <style>', () => {
      for (const fragment of CRITICAL_META_FRAGMENTS) {
        const index = head.indexOf(fragment)
        expect(
          index,
          `${fragment} should appear in <head>`,
        ).toBeGreaterThanOrEqual(0)
        expect(
          index,
          `${fragment} should appear before the first <style>`,
        ).toBeLessThan(firstStyleIndex)
      }
    })

    it('fits every critical OGP meta tag within the slack unfurl byte budget', () => {
      const headPrefix = head.slice(0, SLACK_UNFURL_HEAD_BUDGET_BYTES)
      for (const fragment of CRITICAL_META_FRAGMENTS) {
        expect(
          headPrefix.includes(fragment),
          `${fragment} should appear within the first ${SLACK_UNFURL_HEAD_BUDGET_BYTES} bytes of <head>`,
        ).toBe(true)
      }
    })

    it('emits og:image and og:url as absolute URLs under the production baseUrl', () => {
      // baseUrl は本番値をテスト内に直書きする。`nuxt.config.ts` の runtimeConfig
      // と乖離した場合にもここで検知したい (Slack はリダイレクト後の絶対 URL を
      // canonical と一致させない限り unfurl を失敗させる)。
      const expectedBaseUrl = 'https://nozomi.bike'
      const ogImageMatch = head.match(/property="og:image" content="([^"]+)"/)
      const ogUrlMatch = head.match(/property="og:url" content="([^"]+)"/)
      expect(ogImageMatch?.[1]).toMatch(
        new RegExp(`^${expectedBaseUrl}/ogp/.+\\.png$`),
      )
      expect(ogUrlMatch?.[1]).toMatch(
        new RegExp(`^${expectedBaseUrl}/articles/.+/$`),
      )
    })
  },
)
