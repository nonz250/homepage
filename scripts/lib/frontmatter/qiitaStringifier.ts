import yaml from 'js-yaml'
import type { QiitaFrontmatter } from './toQiitaFrontmatter'

/**
 * Qiita 向け `public/<slug>.md` の frontmatter stringifier。
 *
 * 設計方針:
 *   - qiita-cli (`@qiita/qiita-cli/dist/lib/file-system-repo.js`) の
 *     `toSaveFormat` は `gray-matter.stringify` (= 内部的に js-yaml) を
 *     使っているため、本 stringifier でも **js-yaml 経由** で書き出すと
 *     sync のラウンドトリップで差分が出にくい。ただし qiita-cli はキー順を
 *     `title → tags → private → updated_at → id → organization_url_name →
 *     slide → ignorePublish` で固定しているため、本 stringifier も同じ順で
 *     書き出す (js-yaml で dump する辞書の挿入順に従う性質を利用)。
 *   - Zenn 側と違い byte-parity は要求しない。Qiita CLI が読める形 = 必要十分。
 *   - ignorePublish は true / false いずれも許容する (二段防御の最終判定は
 *     `toQiitaFrontmatter.resolveIgnorePublish` が行う)。本 stringifier では
 *     **bool であること**のみを fail-closed で検査し、未定義 / string / null
 *     など想定外の型が渡されたら throw する。
 */

/**
 * Qiita CLI が期待するキー順 (qiita-cli `toSaveFormat` の order に合わせる)。
 */
const QIITA_KEY_ORDER: ReadonlyArray<keyof QiitaFrontmatter> = [
  'title',
  'tags',
  'private',
  'updated_at',
  'id',
  'organization_url_name',
  'slide',
  'ignorePublish',
]

/**
 * QiitaFrontmatter を `---\n<body>\n---\n` の 1 文字列に変換する。
 *
 * frontmatter 本文は js-yaml.dump で生成する。`noRefs: true` (重複アンカ抑止)
 * と `sortKeys: false` (挿入順維持) を使い、挿入順をキー order に従わせる。
 */
export function stringifyQiitaFrontmatter(fm: QiitaFrontmatter): string {
  if (typeof fm.ignorePublish !== 'boolean') {
    throw new Error(
      '[qiitaStringifier] ignorePublish must be a boolean for public/*.md output (fail-closed)',
    )
  }
  const ordered: Record<string, unknown> = {}
  for (const key of QIITA_KEY_ORDER) {
    const value = fm[key]
    if (value === undefined) {
      continue
    }
    ordered[key] = value
  }
  const body = yaml.dump(ordered, {
    noRefs: true,
    sortKeys: false,
    lineWidth: -1,
    // ブロックスタイルで tags を出すため flowLevel はデフォルト (-1) で OK。
  })
  // dump は末尾に必ず改行を 1 つ付ける。頭・尻の `---\n` で挟んで返す。
  return `---\n${body}---\n`
}
