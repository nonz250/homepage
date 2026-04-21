import { describe, expect, it } from 'vitest'
import { processMarkdownWith, readFixture } from '../../../helpers/processMarkdown'
import { transformMessage } from '../../../../scripts/lib/syntax/transforms/transformMessage'

describe('transformMessage', () => {
  it('rewrites :::message to :::note info and :::message alert to :::note warn (golden)', () => {
    const { input, expected } = readFixture('message')
    const result = processMarkdownWith(input, transformMessage)
    expect(result).toBe(expected)
  })

  it('is idempotent (running twice yields the same result)', () => {
    const { input } = readFixture('message')
    const once = processMarkdownWith(input, transformMessage)
    const twice = processMarkdownWith(once, transformMessage)
    expect(twice).toBe(once)
  })

  it('does not touch Qiita-native :::note info blocks', () => {
    const input = [
      ':::note info',
      '既に Qiita 形式。',
      ':::',
      '',
    ].join('\n')
    const output = processMarkdownWith(input, transformMessage)
    // remark-stringify の整形で backslash エスケープ等の影響は受けうるが、
    // `:::note info` がそのまま残ることだけは保証する。
    expect(output).toContain(':::note info')
    expect(output).not.toContain(':::note warn')
  })

  it('does not rewrite inline text containing ":::message" inside a word', () => {
    // 段落の冒頭 (行頭) にのみ match するため、文中の `:::message` は残る。
    const input = 'この文に :::message と書いても変換しない。\n'
    const output = processMarkdownWith(input, transformMessage)
    expect(output).toContain(':::message')
  })
})
