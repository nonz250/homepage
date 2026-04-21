import type { Code, Root } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Zenn の差分コードブロック記法 ` ```diff <lang> ` を、Qiita 互換の
 * ` ```diff_<lang> ` に変換する mdast transform。
 *
 * 背景:
 *   - Zenn は ` ```diff js ` / ` ```diff ts ` のように「diff + 空白 + 言語名」
 *     で差分ハイライトを有効化する。
 *   - Qiita は同等の機能を ` ```diff_js ` / ` ```diff_ts ` のようにアンダー
 *     スコア連結で表現する。
 *   - 単体の ` ```diff ` は両者で共通のため触らない (Qiita も素の diff を許容)。
 *
 * mdast 上では fenced code block は `code` ノードで表現され、lang フィールド
 * (一次言語) と meta フィールド (残りの情報) に分離される。`diff js` は
 * `lang="diff"`, `meta="js"` と parse される。したがって本 transform は
 * "lang=diff かつ meta が非空" のコードブロックを対象に、lang に
 * `diff_<meta>` を設定し meta を null に戻す。
 */

/**
 * Zenn 記法の一次言語名 (= `diff`)。
 */
const ZENN_DIFF_LANG = 'diff'

/**
 * 言語指定として許容する追加セグメントの形式 (英数字 + ハイフン)。
 *
 * 通常の言語名 (js, ts, python, yaml, html, c++ なども含まれ得るが
 * ここでは highlight.js / prism の慣習に合わせて `[A-Za-z0-9+#_-]+` で扱う)。
 * マッチしない場合は変換しない (安全側 fall-through)。
 */
const DIFF_META_LANG_PATTERN = /^[A-Za-z0-9+#_-]+$/

/**
 * mdast を走査し、`code` ノードのうち `lang="diff" + meta="<lang>"` を
 * `lang="diff_<lang>" + meta=null` に書き換える。
 *
 * 副作用: ノードの lang / meta を in-place で更新する。純関数契約としては
 * 「同じ入力 AST の同じノードは常に同じ出力ノードに変換される」ことで
 * 満たされ、冪等 (再適用してもすでに `diff_js` 形式なら触らない)。
 */
export function transformDiffCode(tree: Root): void {
  visit(tree, 'code', (node: Code) => {
    if (node.lang !== ZENN_DIFF_LANG) {
      return
    }
    const meta = (node.meta ?? '').trim()
    if (meta.length === 0) {
      // Zenn / Qiita どちらでも通る素の ```diff はそのまま。
      return
    }
    // meta が想定形式でない場合は変換しない (破壊を避ける)。
    if (!DIFF_META_LANG_PATTERN.test(meta)) {
      return
    }
    node.lang = `${ZENN_DIFF_LANG}_${meta}`
    node.meta = null
  })
}
