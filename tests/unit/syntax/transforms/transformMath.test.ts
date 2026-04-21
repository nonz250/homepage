import { describe, expect, it } from 'vitest'
import { processMarkdownWith } from '../../../helpers/processMarkdown'
import { transformMath } from '../../../../scripts/lib/syntax/transforms/transformMath'

describe('transformMath', () => {
  it('rewrites inline $expr$ to $`expr`$', () => {
    const input = 'インライン数式 $a\\ne0$ を含む。\n'
    const output = processMarkdownWith(input, transformMath)
    expect(output).toContain('$`a\\ne0`$')
    expect(output).not.toMatch(/(?<!`)\$a\\ne0\$(?!`)/)
  })

  it('rewrites multiple inline math expressions in the same paragraph', () => {
    const input = '$a$ と $b$ と $c$ を並べる。\n'
    const output = processMarkdownWith(input, transformMath)
    expect(output).toContain('$`a`$')
    expect(output).toContain('$`b`$')
    expect(output).toContain('$`c`$')
  })

  it('does not touch inline code containing a dollar', () => {
    // mdast では `$100` は inlineCode として独立ノードになるため、
    // transformMath (text のみ対象) はこれに触らない。
    const input = 'バッククォート内の `$1 + 1$` は触らない。\n'
    const output = processMarkdownWith(input, transformMath)
    expect(output).toContain('`$1 + 1$`')
  })

  it('does not rewrite block math $$...$$ (pass-through per spec)', () => {
    // remark-parse では $$...$$ 全体が 1 つの text ノードの value として
    // 保存される。本 transform の regex は `$$` で始まる/終わる連続を
    // 弾くよう設計しているので、ブロック数式はそのまま保たれる。
    const input = [
      'ブロック数式:',
      '',
      '$$',
      '\\int_0^1 x^2',
      '$$',
      '',
    ].join('\n')
    const output = processMarkdownWith(input, transformMath)
    // ブロック開始と終了の `$$` がいずれも保たれる (= 対が壊れない)
    expect(output.match(/\$\$/g)?.length).toBe(2)
  })

  it('is idempotent when run twice', () => {
    const input = '式 $a\\ne0$ を含む。\n'
    const once = processMarkdownWith(input, transformMath)
    const twice = processMarkdownWith(once, transformMath)
    expect(twice).toBe(once)
  })

  it('leaves a standalone dollar sign alone', () => {
    // 値段 `100 $` のような表記に対してのみ単独の $ しか無い場合、対に
    // ならないので match しないことを確認する。
    const input = '値段は 100 $ 相当だ。\n'
    const output = processMarkdownWith(input, transformMath)
    expect(output).not.toContain('$`')
  })
})
