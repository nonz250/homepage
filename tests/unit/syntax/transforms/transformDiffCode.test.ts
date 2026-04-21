import { describe, expect, it } from 'vitest'
import { processMarkdownWith, readFixture } from '../../../helpers/processMarkdown'
import { transformDiffCode } from '../../../../scripts/lib/syntax/transforms/transformDiffCode'

describe('transformDiffCode', () => {
  it('rewrites ```diff <lang> to ```diff_<lang> (golden)', () => {
    const { input, expected } = readFixture('diffCode')
    const result = processMarkdownWith(input, transformDiffCode)
    expect(result).toBe(expected)
  })

  it('is idempotent (already-converted diff_js blocks are untouched)', () => {
    const { input } = readFixture('diffCode')
    const once = processMarkdownWith(input, transformDiffCode)
    const twice = processMarkdownWith(once, transformDiffCode)
    expect(twice).toBe(once)
  })

  it('does not touch plain non-diff languages', () => {
    const input = '```js\nconst x = 1\n```\n'
    const output = processMarkdownWith(input, transformDiffCode)
    expect(output).toContain('```js')
    expect(output).not.toContain('```diff_')
  })

  it('does not touch bare ```diff code blocks', () => {
    const input = '```diff\n- a\n+ b\n```\n'
    const output = processMarkdownWith(input, transformDiffCode)
    expect(output).toContain('```diff')
    expect(output).not.toContain('```diff_')
  })
})
