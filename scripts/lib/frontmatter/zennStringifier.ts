import type { ZennFrontmatter } from './toZennFrontmatter'

/**
 * Zenn 向け `articles/<slug>.md` frontmatter の **byte 一致保証** stringifier。
 *
 * gray-matter の stringify は js-yaml に委譲するため、量指定子やキー順、
 * quote スタイル、flow/block 切り替えの挙動が不安定。本モジュールは自前で
 * 文字列を組み立てることで、既存 Zenn 記事 (`articles/nonz250-ai-rotom.md`)
 * を **1 byte も変えない** ことを担保する。
 *
 * 観測した現行仕様 (hex dump 結果 — articles/nonz250-ai-rotom.md):
 *   - ファイル先頭: `---\n`
 *   - キー順: title → emoji → type → topics → published → published_at
 *   - title: `title: "..."` — ダブルクォート
 *   - emoji: `emoji: "..."` — ダブルクォート (U+1F916, variation selector 無し)
 *   - type:  `type: "..."` — ダブルクォート
 *   - topics: `topics: ["ai", "mcp", "typescript", "pokemon"]` —
 *     フロースタイル、カンマの後ろに半角空白 1 つ
 *   - published: `published: true` — 裸の bool
 *   - published_at: `published_at: '...'` — **シングルクォート**
 *   - frontmatter 終端: `---\n`
 *
 * 本 stringifier は上記に厳密に従う。将来 Zenn 側の推奨書式が変わった場合は
 * 既存記事の byte 変更を伴うため、慎重に設計変更する必要がある。
 */

/**
 * YAML double-quoted scalar のために文字列をエスケープする。
 *
 * 最小実装として `\` と `"` のみエスケープする。制御文字等の厳密な
 * エスケープは現行記事の運用範囲外のため割愛するが、制御文字が入った場合は
 * throw してプリ委託する (fail-closed)。
 */
function escapeDoubleQuoted(value: string): string {
  // 制御文字 (改行 / タブ / NUL 等) は reject する。YAML double-quoted では
  // `\n` / `\t` のエスケープが必要だが、運用上の title / emoji / type は
  // 1 行 plain 想定なので fail-closed で切り捨てる。
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(
      `[zennStringifier] control character in double-quoted value: ${JSON.stringify(value)}`,
    )
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * YAML single-quoted scalar のために文字列をエスケープする。
 *
 * single-quoted YAML の仕様: `'` は `''` に escape。他の文字 (バックスラッシュ
 * 含む) はそのまま。制御文字は double-quoted 同様 reject。
 */
function escapeSingleQuoted(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(
      `[zennStringifier] control character in single-quoted value: ${JSON.stringify(value)}`,
    )
  }
  return value.replace(/'/g, "''")
}

/**
 * topics を `[ "a", "b", ... ]` のフロースタイルに変換する。
 *
 * 現行ファイルの表記は `["ai", "mcp", ...]` (前後 `[ ]` の内側空白 **なし**)
 * かつ `, ` (カンマ後に半角空白 1 つ)。各要素はダブルクォート文字列。
 *
 * 空配列の場合は `[]` を出す。
 */
function stringifyTopics(topics: readonly string[]): string {
  if (topics.length === 0) {
    return '[]'
  }
  const quoted = topics.map((t) => `"${escapeDoubleQuoted(t)}"`)
  return `[${quoted.join(', ')}]`
}

/**
 * ZennFrontmatter を `---\n<body>\n---\n` の 1 文字列に変換する。
 *
 * 戻り値の末尾は **`---\n`** (1 改行) までで、本文との間の空行はこの関数の
 * 責務外。呼び出し側で `+ body` して書き込むと body 側の先頭改行で自然に
 * `---\n\n` の区切りになる (= 現行ファイル通り)。
 */
export function stringifyZennFrontmatter(fm: ZennFrontmatter): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`title: "${escapeDoubleQuoted(fm.title)}"`)
  if (fm.emoji !== undefined) {
    lines.push(`emoji: "${escapeDoubleQuoted(fm.emoji)}"`)
  }
  lines.push(`type: "${escapeDoubleQuoted(fm.type)}"`)
  lines.push(`topics: ${stringifyTopics(fm.topics)}`)
  lines.push(`published: ${fm.published ? 'true' : 'false'}`)
  lines.push(`published_at: '${escapeSingleQuoted(fm.published_at)}'`)
  lines.push('---')
  // 末尾の改行まで含めて返す (join 結果の最終行の後ろに 1 つ)。
  return lines.join('\n') + '\n'
}
