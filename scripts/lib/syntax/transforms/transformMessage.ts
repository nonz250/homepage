import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Zenn 記法 `:::message` コンテナを Qiita 記法 `:::note info` / `:::note warn`
 * に変換する mdast transform。
 *
 * 入出力契約:
 *   - in : `paragraph > text(":::message[ alert]\n...\n:::")` を含む Root
 *   - out: text value が Qiita の note 記法に置換された Root (破壊的変更)
 *
 * remark-parse は `:::message` で始まる段落をコンテナ記法として認識せず、
 * 単なる複数行 text として扱う。したがって本 transform は paragraph の
 * text value を regex で検査し、開始タグ `:::message` / `:::message alert` を
 * それぞれ Qiita の `:::note info` / `:::note warn` に置換する。閉じ `:::` は
 * Qiita 側でも `:::` のまま有効なので変更しない。
 *
 * この transform は **純関数** である (外部 I/O なし)。同じ tree を 2 回
 * 渡しても結果が変わらない (冪等性) ように、既に Qiita 形式 (`:::note `) に
 * なっているものは再置換しない。
 */

/**
 * `:::message` 記法の開始行 (alert 引数あり / なし両対応) を検出する regex。
 *
 * グループ:
 *   1. alert 引数 (ある場合) または undefined
 */
const MESSAGE_OPENER_PATTERN = /^:::message(?:[ \t]+(alert))?(?=\n|$)/

/**
 * Zenn の `:::message` を Qiita の `:::note info` に変換したときの開始行。
 */
const QIITA_NOTE_INFO_OPENER = ':::note info'

/**
 * Zenn の `:::message alert` を Qiita の `:::note warn` に変換したときの開始行。
 */
const QIITA_NOTE_WARN_OPENER = ':::note warn'

/**
 * 1 つの text value 内で、先頭が `:::message` / `:::message alert` なら Qiita
 * 向けに置換した文字列を返す。そうでなければそのまま返す。
 */
function rewriteMessageOpenerInText(value: string): string {
  const match = value.match(MESSAGE_OPENER_PATTERN)
  if (match === null) {
    return value
  }
  const hasAlert = match[1] === 'alert'
  const opener = hasAlert ? QIITA_NOTE_WARN_OPENER : QIITA_NOTE_INFO_OPENER
  return value.replace(MESSAGE_OPENER_PATTERN, opener)
}

/**
 * mdast tree を走査し、text node の先頭に Zenn message 記法が残っていれば
 * Qiita 互換表記に書き換える。
 *
 * text node の位置は paragraph 直下に限らない (例: container 内部に入れ子)
 * ため、`unist-util-visit` で type='text' を再帰探索する。
 */
export function transformMessage(tree: Root): void {
  visit(tree, 'text', (node) => {
    node.value = rewriteMessageOpenerInText(node.value)
  })
}
