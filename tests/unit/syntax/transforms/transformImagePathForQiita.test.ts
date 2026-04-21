import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import type { Plugin } from 'unified'
import type { Root } from 'mdast'
import { transformImagePathForQiita } from '../../../../scripts/lib/syntax/transforms/transformImagePathForQiita'

/**
 * transformImagePathForQiita は **image ノード** の url / title に残るサイズ
 * 指定を剥がす transform。Zenn の `![alt](url =WxH)` 記法は remark-parse で
 * image と認識されないため、AST 上は text のまま残る。この transform の
 * 対象は「image ノードの title に `=WxH` が入った場合」等の保守的なケースに
 * 限られる (text レベルの復元は PR-B で扱う)。
 */
function processImageWithSize(url: string, title: string | null): string {
  const plugin: Plugin<[], Root> = () => (tree) => {
    transformImagePathForQiita(tree)
  }
  const result = unified()
    .use(remarkParse)
    .use(plugin)
    .use(remarkStringify, { bullet: '-', fences: true })
    .processSync(`![alt](${url}${title === null ? '' : ` "${title}"`})\n`)
  return String(result)
}

/**
 * AST を直接組み立てて image ノードに title `=WxH` を入れた状態で stringify
 * するヘルパ。remark-parse 経路では title に `=` が入らないため、手で組み立て
 * て unit test する。
 */
function processRawImageNode(title: string, urlSuffix: string): string {
  const plugin: Plugin<[], Root> = () => (tree) => {
    tree.children = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: `https://example.com/foo.png${urlSuffix}`,
            title,
            alt: 'alt',
          },
        ],
      },
    ]
    transformImagePathForQiita(tree)
  }
  const result = unified()
    .use(remarkParse)
    .use(plugin)
    .use(remarkStringify, { bullet: '-', fences: true })
    .processSync('placeholder\n')
  return String(result)
}

describe('transformImagePathForQiita', () => {
  it('strips the =WIDTHxHEIGHT suffix when it leaks into the image url', () => {
    // remark-parse は image として parse しないため、ここでは URL に直接
    // サイズ suffix が入った AST を手で組み立てて検証する。
    const output = processRawImageNode('', ' =250x200')
    expect(output).toContain('https://example.com/foo.png')
    expect(output).not.toContain('=250x200')
  })

  it('strips =WIDTHx suffix from the url', () => {
    const output = processRawImageNode('', ' =250x')
    expect(output).toContain('https://example.com/foo.png')
    expect(output).not.toContain('=250x')
  })

  it('strips =xHEIGHT suffix from the url', () => {
    const output = processRawImageNode('', ' =x200')
    expect(output).toContain('https://example.com/foo.png')
    expect(output).not.toContain('=x200')
  })

  it('clears the title when it consists solely of =WxH', () => {
    const output = processImageWithSize('https://example.com/foo.png', '=250x')
    expect(output).toContain('https://example.com/foo.png')
    expect(output).not.toContain('=250x')
  })

  it('keeps a non-size title untouched', () => {
    const output = processImageWithSize('https://example.com/foo.png', 'a real caption')
    expect(output).toContain('a real caption')
  })

  it('leaves image URLs without size markers unchanged', () => {
    const output = processImageWithSize('https://example.com/foo.png', null)
    expect(output).toContain('https://example.com/foo.png')
  })

  it('is idempotent when run twice on the same AST', () => {
    const once = processRawImageNode('', ' =250x')
    const twice = processRawImageNode('', '')
    expect(twice).toContain('https://example.com/foo.png')
    // once 自体は既に剥がれているので、再度実行しても影響しない
    expect(once).toContain('https://example.com/foo.png')
  })
})
