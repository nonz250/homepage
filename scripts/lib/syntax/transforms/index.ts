import type { Root } from 'mdast'
import { transformCard } from './transformCard'
import { transformDetails } from './transformDetails'
import { transformDiffCode } from './transformDiffCode'
import { transformImage, type TransformImageOptions } from './transformImage'
import { transformImagePathForQiita } from './transformImagePathForQiita'
import { transformMath } from './transformMath'
import { transformMessage } from './transformMessage'
import { rejectUnsupportedZennSyntax } from '../rejectUnsupportedZennSyntax'

/**
 * Zenn → Qiita 変換パイプラインの適用順序 (名前とハンドラのペア)。
 *
 * 設計上、順序は意味を持つ:
 *   1. rejectUnsupportedZennSyntax — 早期 fail。後段で text が書き換えられて
 *      しまうと検出が難しくなるため、最初に未対応記法の throw を済ませる。
 *   2. transformCard — `@[service](url)` を裸 URL + 空行に置換。
 *      これより後の transforms が link / text を前提に走るため、embed を
 *      先に potrait-free 化しておく。
 *   3. transformMessage — `:::message` → `:::note info/warn`。text 置換のみ。
 *   4. transformDetails — `:::details title\n...\n:::` → `<details>` 展開。
 *      transformMessage より後に置くのは message 系の重複 text を残さない
 *      ためだが、現段階では両者独立なので依存は弱い。
 *   5. transformImage — image ノードの URL を raw.githubusercontent 化。
 *      commitSha が必要なため options を取るバリアント。
 *   6. transformImagePathForQiita — transformImage 後に残ったサイズ指定
 *      (image.title = "=250x" 等) を剥がす。順序依存: transformImage 後。
 *   7. transformMath — インライン $expr$ → $`expr`$ を html ノード化。
 *      transformImage 前に走らせると、image 内の $ を誤検知する可能性が
 *      あるため image 系より後ろに置く。
 *   8. transformDiffCode — fenced code の lang を diff_js 形式に。
 *      コードブロックは独立なので順序依存は弱いが、list の末尾で一括
 *      処理する。
 *
 * `ZENN_TO_QIITA_TRANSFORMS_NAMES` は順序検証テストで参照する名前配列。
 * 実体の transform は transformImage のみ options を取るため、パイプラインを
 * 実行する generator (PR-B) は name → 実体のマッピングを使って必要な options
 * を注入する。
 */

/**
 * パイプラインを構成する transform の名前と適用順。
 *
 * `as const` で tuple 型を保ち、順序検証テストで === 比較ができるようにする。
 */
export const ZENN_TO_QIITA_TRANSFORM_NAMES = [
  'rejectUnsupportedZennSyntax',
  'transformCard',
  'transformMessage',
  'transformDetails',
  'transformImage',
  'transformImagePathForQiita',
  'transformMath',
  'transformDiffCode',
] as const

/**
 * transform 名の静的型。順序検証や generator からの参照で使う。
 */
export type ZennToQiitaTransformName =
  (typeof ZENN_TO_QIITA_TRANSFORM_NAMES)[number]

/**
 * 各 transform を適用できる共通シグネチャ (option あり / なし両対応)。
 *
 * transformImage のみ options (commitSha) を要求する。generator は image
 * 変換用の commitSha を外部から解決し、このレコードに入れてパイプラインを
 * 駆動する。
 */
export interface PipelineOptions {
  readonly image: TransformImageOptions
}

/**
 * 名前 → 実体の transform 関数のマッピング。
 *
 * 各関数は Root を mutate する純関数 (I/O なし)。transformImage のみ
 * options を必要とするため、クロージャで options を受け取る関数を返す。
 */
export function buildTransformRegistry(
  options: PipelineOptions,
): Readonly<Record<ZennToQiitaTransformName, (tree: Root) => void>> {
  return {
    rejectUnsupportedZennSyntax,
    transformCard,
    transformMessage,
    transformDetails,
    transformImage: (tree) => transformImage(tree, options.image),
    transformImagePathForQiita,
    transformMath,
    transformDiffCode,
  }
}

/**
 * 与えられた AST に対し、登録順で transforms を適用する。
 *
 * generator からの利用を想定する薄いヘルパ。テスト側ではこの関数を
 * 直接呼び出さず、個別の transform を単体テストで検証する。
 */
export function applyZennToQiitaPipeline(
  tree: Root,
  options: PipelineOptions,
): void {
  const registry = buildTransformRegistry(options)
  for (const name of ZENN_TO_QIITA_TRANSFORM_NAMES) {
    registry[name](tree)
  }
}
