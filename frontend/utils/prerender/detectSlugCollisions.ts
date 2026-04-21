/**
 * 記事 Markdown の slug 衝突を検出する純関数。
 *
 * v3 までは `articles/` (Zenn 共有) と `site-articles/` (本サイト限定) の
 * 2 ディレクトリを同一コレクションとして読み込む構成であり、同じ slug
 * (= ファイル名) のファイルが両方に存在するとどちらが優先されるか不定に
 * なるため build 時に fail させるのが主目的だった。
 * v4 では source が `site-articles/` に一本化されたためディレクトリ間の
 * 衝突は起こり得ないが、将来の拡張 (複数 source 再導入や subdir 運用) への
 * 安全網として API は維持する。単一 source 入力でも空配列を返すだけの
 * no-op として動き、性能上の影響は無視できる。
 *
 * I/O (ファイル列挙) は呼び出し側で行い、この関数はあくまで純粋な判定のみに
 * 責務を限定する。こうすることで vitest からテーブル駆動でのテストが容易になる。
 */

/**
 * ファイルベースで記述した記事 1 本分の入力。
 *
 * - `slug`: ファイル名 (拡張子なし)。Zenn と同じ慣習を採用する
 * - `absPath`: エラーメッセージで参照できる絶対パス (表示用のみ、相対でもよい)
 */
export interface SlugSourceEntry {
  readonly slug: string
  readonly absPath: string
}

/**
 * 1 件の slug 衝突レコード。
 *
 * 同じ slug を持つパスを 2 つ以上含み、エラーメッセージの生成に使われる。
 */
export interface SlugCollision {
  readonly slug: string
  readonly paths: readonly string[]
}

/**
 * `detectSlugCollisions` の結果。衝突が存在しない場合は空配列を返す。
 */
export type SlugCollisionReport = readonly SlugCollision[]

/**
 * 複数のディレクトリにまたがる記事エントリ集合から、同一 slug で複数ファイルが
 * 存在するものを抽出する。
 *
 * - 空配列入力 → 空配列 (衝突なし)
 * - 同 slug が 1 件のみ → 衝突なし
 * - 同 slug が 2 件以上 → `paths` に全件を格納した 1 レコードを返す
 * - 出力順は `slug` の ASCII 昇順で安定化 (テスト容易性のため)
 *
 * 呼び出し側は結果が非空であれば build を失敗させ、そうでなければ
 * そのまま処理を続行する、というシンプルな契約で利用する。
 */
export function detectSlugCollisions(
  entries: readonly SlugSourceEntry[],
): SlugCollisionReport {
  const bucket = new Map<string, string[]>()
  for (const entry of entries) {
    const existing = bucket.get(entry.slug)
    if (existing === undefined) {
      bucket.set(entry.slug, [entry.absPath])
    } else {
      existing.push(entry.absPath)
    }
  }

  const collisions: SlugCollision[] = []
  for (const [slug, paths] of bucket.entries()) {
    if (paths.length > 1) {
      collisions.push({ slug, paths: [...paths] })
    }
  }

  collisions.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  return collisions
}

/**
 * `SlugCollisionReport` を人間が読めるエラーメッセージにフォーマットする。
 *
 * ビルドログから「どの slug がどの 2 つのファイルで衝突したか」が即座に
 * 追えるよう、1 行 1 情報の形式で出力する。
 */
export function formatSlugCollisionError(
  report: SlugCollisionReport,
): string {
  if (report.length === 0) {
    return ''
  }
  const lines: string[] = [
    'articles slug collision detected between source directories:',
  ]
  for (const collision of report) {
    lines.push(`  - slug: ${collision.slug}`)
    for (const path of collision.paths) {
      lines.push(`      ${path}`)
    }
  }
  return lines.join('\n')
}
