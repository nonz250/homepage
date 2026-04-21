import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Root } from 'mdast'
import type { Plugin } from 'unified'

/**
 * transform (mdast AST in → AST out の純関数) を受け取り、input Markdown に
 * 適用して整形後の文字列を返す汎用ヘルパ。
 *
 * 各 transform は `(tree: Root, options?: T) => void | Root` の形で実装する
 * 想定 (破壊的変更 or 置換返却のどちらも許容) し、ヘルパ側で Plugin 形式に
 * 包んで unified パイプラインに繋ぐ。
 */
export type MdastTransform<TOptions = void> = TOptions extends void
  ? (tree: Root) => void
  : (tree: Root, options: TOptions) => void

/**
 * 与えられた transform を適用した結果の Markdown 文字列を返す。
 *
 * 大文字小文字やインデントなどの微妙な差は remark-stringify のオプションに
 * 左右されるため、オプションは Zenn に寄せて固定する (= Zenn の書き癖を
 * 保ちつつ意味が変わらない範囲で整形)。
 */
export function processMarkdownWith(
  input: string,
  transform: MdastTransform,
): string {
  const transformPlugin: Plugin<[], Root> = () => (tree) => {
    transform(tree)
  }
  const result = unified()
    .use(remarkParse)
    .use(transformPlugin)
    .use(remarkStringify, {
      bullet: '-',
      fences: true,
      incrementListMarker: false,
      listItemIndent: 'one',
      emphasis: '_',
      strong: '*',
    })
    .processSync(input)
  return String(result)
}

/**
 * transform を **オプション付き** で適用する場合のヘルパ。
 */
export function processMarkdownWithOptions<T>(
  input: string,
  transform: (tree: Root, options: T) => void,
  options: T,
): string {
  const transformPlugin: Plugin<[], Root> = () => (tree) => {
    transform(tree, options)
  }
  const result = unified()
    .use(remarkParse)
    .use(transformPlugin)
    .use(remarkStringify, {
      bullet: '-',
      fences: true,
      incrementListMarker: false,
      listItemIndent: 'one',
      emphasis: '_',
      strong: '*',
    })
    .processSync(input)
  return String(result)
}

/**
 * transform fixture (input.md / expected.md) を読み込むヘルパ。
 *
 * 置き場所は `tests/fixtures/transforms/<name>/{input,expected}.md`。
 */
export function readFixture(name: string): {
  input: string
  expected: string
} {
  const dir = resolve(__dirname, '../fixtures/transforms', name)
  const input = readFileSync(resolve(dir, 'input.md'), 'utf8')
  const expected = readFileSync(resolve(dir, 'expected.md'), 'utf8')
  return { input, expected }
}
