import { describe, expect, it } from 'vitest'
import { processMarkdownWith, readFixture } from '../../../helpers/processMarkdown'
import { transformDetails } from '../../../../scripts/lib/syntax/transforms/transformDetails'

describe('transformDetails', () => {
  it('rewrites :::details <title>...::: to <details><summary>...</summary>... (golden)', () => {
    const { input, expected } = readFixture('details')
    const result = processMarkdownWith(input, transformDetails)
    expect(result).toBe(expected)
  })

  it('escapes HTML special characters in the plain-text title', () => {
    // タイトルに raw HTML (`<script>` 等) が生で含まれるケースは remark-parse
    // が独立した html ノードに分解するため、本 transform の単一 text 条件を
    // 満たさずそのまま通過する。これは設計上の意図 (タイトルに raw HTML を
    // 書かない前提) と一致する。
    //
    // 一方、title に生の `&` や `"` が text ノードとして入った場合は、
    // summary タグに挿入する際に escapeHtml で `&amp;` / `&quot;` に
    // エスケープされる。remark-parse は `&amp;` を `&` に decode してから
    // text ノードに格納するため、入力が `プラン&価格` でも `プラン&amp;価格`
    // でも text value は `プラン&価格` になり、escape 後は `プラン&amp;価格`
    // となる。
    const safeInput = [
      ':::details プラン&価格',
      '本文',
      ':::',
      '',
    ].join('\n')
    const safeOutput = processMarkdownWith(safeInput, transformDetails)
    expect(safeOutput).toContain('<summary>プラン&amp;価格</summary>')
  })

  it('leaves paragraphs without :::details unchanged', () => {
    const input = 'ただの段落。\n'
    const output = processMarkdownWith(input, transformDetails)
    expect(output).toBe('ただの段落。\n')
  })

  it('is idempotent (running twice yields the same result)', () => {
    const { input } = readFixture('details')
    const once = processMarkdownWith(input, transformDetails)
    const twice = processMarkdownWith(once, transformDetails)
    expect(twice).toBe(once)
  })
})
