/**
 * Zenn 互換 Mermaid コードフェンス (` ```mermaid ... ``` `) を
 * `ZennMermaid` MDC コンポーネントの `containerComponent` mdast ノードに
 * 書き換える remark プラグイン。
 *
 * 役割:
 *   - ```mermaid\n<DSL>\n``` の ```code``` ノードを `<zenn-mermaid code="...">`
 *     に変換し、クライアント側の動的 import (`mermaid` パッケージ) で SVG
 *     描画する入り口を提供する
 *   - build 時に DSL のバリデーションや render は行わない (mermaid を build
 *     時に読み込むと SSR 経路で window 依存により失敗するため、クライアント
 *     限定で扱う設計)
 *
 * 設計上の選択:
 *   - `@[mermaid]` inline directive 形式は**サポートしない**。remark-mdc が
 *     inline directive を `<span>mermaid</span>` に昇格させる挙動は Zenn の
 *     本家仕様とも揃わず不安定なため、コードフェンス記法のみを正式入力とする。
 *     inline 形式が残留した場合は `rehypeAssertNoZennLeftovers` が検知して
 *     build fail させる契約 (本プラグインは関与しない)
 *   - コードフェンスの `lang` が `mermaid` 以外のもの (例: `js`, `typescript`)
 *     は一切触らず素通しする。shiki や highlight.js 系の後段処理を阻害しない
 *   - 空の mermaid フェンス (` ```mermaid\n``` `) も素通しではなく変換対象に
 *     する。空 DSL は mermaid 側の render でエラーになるが、その失敗は
 *     コンポーネント側の catch で fallback に倒す
 */
import { visit } from 'unist-util-visit'
import type { Code, Parent, Root } from 'mdast'
import { ZENN_MERMAID_TAG } from '../../constants/zenn-mdc'
import { MERMAID_CODE_LANGUAGE } from '../../constants/zenn-embed'

/**
 * remark-mdc 由来の `containerComponent` ノードを本プラグイン内で生成する
 * ため、ローカルで型を宣言する (他の remark-zenn-* プラグインと同じパターン)。
 */
interface ContainerComponentNode extends Parent {
  type: 'containerComponent'
  name: string
  attributes?: Record<string, string>
  fmAttributes?: Record<string, unknown>
}

/**
 * mdast の RootContent ユニオンに `containerComponent` を注入する
 * module augmentation。他の remark-zenn-* と揃える。
 */
declare module 'mdast' {
  interface RootContentMap {
    containerComponent: ContainerComponentNode
  }
}

/**
 * `<zenn-mermaid>` に渡す属性名。MDC は kebab-case → PascalCase の prop 解決を
 * 行うため、コンポーネント側 `code: string` に対応する属性名は `code` のまま。
 */
const MERMAID_CODE_ATTRIBUTE_NAME = 'code'

/**
 * remark プラグイン本体。unist-util-visit で `code` ノードを走査し、
 * `lang === 'mermaid'` のものだけを `containerComponent` に書き換える。
 *
 * visit の第 3 引数 (index) と第 4 引数 (parent) を使って parent.children の
 * 該当インデックスを直接差し替える。AST 書き換えは visitor 内で行うが、
 * node.type を変えるため visit の再走査挙動には影響しない (mermaid 変換後は
 * code ノードではなくなるため、二重変換は発生しない)。
 */
export default function remarkZennMermaid() {
  return (tree: Root): void => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang !== MERMAID_CODE_LANGUAGE) {
        return
      }
      if (parent === undefined || index === undefined) {
        return
      }
      const replacement = buildMermaidContainer(node.value)
      const children = parent.children
      children[index] = replacement as typeof children[number]
    })
  }
}

/**
 * 単一の code 値から containerComponent ノードを生成する。
 *
 * `code` 属性にはフェンス内の DSL をそのまま載せる。特殊文字のエスケープは
 * MDC (@nuxtjs/mdc) が attribute の serialize 時に行うため、ここでは生文字列
 * をそのまま渡して良い。`data.hName` / `data.hProperties` は remark-mdc →
 * mdast-util-to-hast の変換で使われる必須フィールド。
 */
function buildMermaidContainer(code: string): ContainerComponentNode {
  const attributes = { [MERMAID_CODE_ATTRIBUTE_NAME]: code }
  return {
    type: 'containerComponent',
    name: ZENN_MERMAID_TAG,
    attributes,
    children: [],
    data: {
      hName: ZENN_MERMAID_TAG,
      hProperties: { ...attributes },
    },
  }
}
