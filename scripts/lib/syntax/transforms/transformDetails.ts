import type { Root, RootContent } from 'mdast'

/**
 * Zenn のトグル記法 `:::details <title>\n...\n:::` を Qiita 互換の
 * `<details><summary>...</summary>\n\n...\n\n</details>` に変換する
 * mdast transform。
 *
 * Zenn / Qiita の差分:
 *   - Zenn: `:::details <title>` というコンテナ記法
 *   - Qiita: 標準 HTML タグ `<details><summary>` をそのまま記述
 *
 * 設計:
 *   - `:::message` と同様、remark-parse は `:::details` を独立ブロックと
 *     して認識せず、単一 paragraph の text value に `:::details title\n
 *     本文\n:::` の形で格納する。
 *   - 本 transform は Root の children を走査し、paragraph の text value が
 *     `:::details ` で始まり最終行が `:::` の形 (= 単一 paragraph にコンテナ
 *     全体が詰まっている) であれば、`html` ノード 3 つ (`<details>...`,
 *     `paragraph(body)`, `</details>`) に差し替える。
 *   - 段落をまたいでコンテナがある (空行を含む本文) ケースは、remark-parse
 *     が別 paragraph として扱う。このケースは本 transform では **暫定通過**
 *     とし、ADR に preview 検証後 throw の方針を明記する予定 (指示書より)。
 *     現段階では "単一 paragraph に閉じたコンテナ" のみを変換対象とし、
 *     それ以外は text のまま残す。
 */

/**
 * `:::details <title>\n<body>\n:::` の形を検出する regex。
 * グループ:
 *   1. title (空白含む 1 行、末尾改行は含まない)
 *   2. body (任意、改行を含む可能性あり)
 */
const DETAILS_SINGLE_PARAGRAPH_PATTERN =
  /^:::details[ \t]+([^\n]*)\n([\s\S]*?)\n:::$/

/**
 * Qiita 向けの details 開始タグ / 終了タグ。
 * summary の `title` 部分は HTML 要素として出力するため、HTML 特殊文字を
 * エスケープしてから流し込む。
 */
const DETAILS_CLOSE_HTML = '</details>'

/**
 * HTML 特殊文字をエスケープする最小実装。
 *
 * summary に `<` や `&` が含まれていた場合、それを生で html ノードに入れると
 * Qiita 側で invalid markup になる。必要最小限の 4 文字をエスケープする。
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Root の children を走査し、paragraph 内に `:::details <title>\n<body>\n:::`
 * の形が単一 text として格納されていれば、`html` + `paragraph` + `html` の
 * 3 ノードに差し替える。
 *
 * 副作用: Root の children を in-place で置換する。
 */
export function transformDetails(tree: Root): void {
  const original = tree.children
  const rewritten: RootContent[] = []
  for (const child of original) {
    if (child.type !== 'paragraph') {
      rewritten.push(child)
      continue
    }
    if (child.children.length !== 1) {
      rewritten.push(child)
      continue
    }
    const inner = child.children[0]
    if (!inner || inner.type !== 'text') {
      rewritten.push(child)
      continue
    }
    const match = inner.value.match(DETAILS_SINGLE_PARAGRAPH_PATTERN)
    if (match === null) {
      rewritten.push(child)
      continue
    }
    const title = match[1] ?? ''
    const body = match[2] ?? ''
    rewritten.push({
      type: 'html',
      value: `<details><summary>${escapeHtml(title.trim())}</summary>`,
    })
    if (body.length > 0) {
      rewritten.push({
        type: 'paragraph',
        children: [{ type: 'text', value: body }],
      })
    }
    rewritten.push({ type: 'html', value: DETAILS_CLOSE_HTML })
  }
  tree.children = rewritten
}
