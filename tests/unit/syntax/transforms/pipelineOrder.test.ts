import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import type { Root } from 'mdast'
import {
  ZENN_TO_QIITA_TRANSFORM_NAMES,
  applyZennToQiitaPipeline,
  buildTransformRegistry,
} from '../../../../scripts/lib/syntax/transforms'

/**
 * パイプラインの順序と合成動作の回帰テスト。
 *
 * 個別 transform のユニットテストは他ファイルで網羅されているため、ここでは
 * 「名前リストの順序」と「パイプラインを通しても fixture が期待通りに変換される」
 * ことを確認する。
 */
describe('ZENN_TO_QIITA_TRANSFORM_NAMES', () => {
  it('exposes exactly 8 transforms in the documented order', () => {
    expect([...ZENN_TO_QIITA_TRANSFORM_NAMES]).toEqual([
      'rejectUnsupportedZennSyntax',
      'transformCard',
      'transformMessage',
      'transformDetails',
      'transformImage',
      'transformImagePathForQiita',
      'transformMath',
      'transformDiffCode',
    ])
  })

  it('registry exposes a handler for every listed name', () => {
    const registry = buildTransformRegistry({
      image: { commitSha: 'a'.repeat(40) },
    })
    for (const name of ZENN_TO_QIITA_TRANSFORM_NAMES) {
      expect(typeof registry[name]).toBe('function')
    }
  })
})

describe('applyZennToQiitaPipeline (smoke)', () => {
  it('runs all transforms in order without throwing on a realistic input', () => {
    const sha = '0123456789abcdef0123456789abcdef01234567'
    const input = [
      '# Title',
      '',
      '@[card](https://github.com/nonz250/ai-rotom)',
      '',
      ':::message',
      '情報メッセージ',
      ':::',
      '',
      ':::details タイトル',
      '本文',
      ':::',
      '',
      '![cat](/images/cat.png)',
      '',
      '数式 $a\\ne0$ を含む。',
      '',
      '```diff js',
      '- old',
      '+ new',
      '```',
      '',
    ].join('\n')
    const result = unified()
      .use(remarkParse)
      .use(() => (tree: Root) => {
        applyZennToQiitaPipeline(tree, { image: { commitSha: sha } })
      })
      .use(remarkStringify, { bullet: '-', fences: true })
      .processSync(input)
    const out = String(result)
    expect(out).toContain('https://github.com/nonz250/ai-rotom')
    expect(out).toContain(':::note info')
    expect(out).toContain('<details><summary>タイトル</summary>')
    expect(out).toContain(sha)
    expect(out).toContain('$`a\\ne0`$')
    expect(out).toContain('```diff_js')
  })

  it('throws when the input contains an unsupported directive (fail-closed)', () => {
    const input = '@[slideshare](https://slideshare.net/foo)\n'
    const run = (): string => {
      return String(
        unified()
          .use(remarkParse)
          .use(() => (tree: Root) => {
            applyZennToQiitaPipeline(tree, {
              image: { commitSha: 'a'.repeat(40) },
            })
          })
          .use(remarkStringify, {})
          .processSync(input),
      )
    }
    expect(run).toThrowError(/unsupported Zenn embed/)
  })
})
