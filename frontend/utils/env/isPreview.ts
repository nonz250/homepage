/**
 * CONTENT_PREVIEW 環境変数の truthy 判定用トークン集合。
 *
 * 比較は大文字小文字を問わずに行うため、ここには小文字形のみを保持する。
 * マジックストリングの散在を避け、受理される値を 1 箇所に集約する。
 */
const PREVIEW_TRUTHY_VALUES = new Set<string>(['1', 'true', 'yes'])

/**
 * 環境変数 `CONTENT_PREVIEW` の値を真偽値に正規化する純関数。
 *
 * 下記トークンのいずれか (大文字小文字非依存、前後の空白を除去した値) であれば `true` を返す:
 *
 *   '1', 'true', 'yes'
 *
 * それ以外 (未設定 / 空文字 / 空白のみ / '0' / 'false' / 'no' など) は `false`。
 *
 * ここでの目的は「プレビュー表示を許可するか」の単一フラグに集約することであり、
 * 副作用を持たず同じ入力に対して常に同じ出力を返す (テスト容易性重視)。
 */
export function normalizePreviewFlag(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized === '') {
    return false
  }
  return PREVIEW_TRUTHY_VALUES.has(normalized)
}
