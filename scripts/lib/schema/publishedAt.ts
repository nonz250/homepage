import { z } from 'zod'
import {
  PUBLISHED_AT_ISO_OFFSET_PATTERN,
  PUBLISHED_AT_ISO_UTC_PATTERN,
  PUBLISHED_AT_ZENN_LEGACY_PATTERN,
} from '../constants'

/**
 * `published_at` が受け取る 3 つの書式に対応する regex のリスト。
 *
 * いずれか 1 つに match すれば accept。順序は優先度を意味しない。
 */
const ACCEPTED_PUBLISHED_AT_PATTERNS: readonly RegExp[] = [
  PUBLISHED_AT_ZENN_LEGACY_PATTERN,
  PUBLISHED_AT_ISO_OFFSET_PATTERN,
  PUBLISHED_AT_ISO_UTC_PATTERN,
]

/**
 * published_at の不正値 reject 時に zod issue として発行される日本語メッセージ。
 *
 * ユーザーが記事 frontmatter を手書きで修正する際に「どの形式なら OK か」が
 * 即判明するよう、3 形式を本文に列挙する。
 */
export const PUBLISHED_AT_FORMAT_ERROR_MESSAGE =
  'published_at は次のいずれかの形式で指定してください: ' +
  '"YYYY-MM-DD HH:mm" (例: 2026-04-19 21:00), ' +
  '"YYYY-MM-DDTHH:mm:ss±HH:mm" (例: 2026-04-19T21:00:00+09:00), ' +
  '"YYYY-MM-DDTHH:mm:ssZ" (例: 2026-04-19T12:00:00Z)'

/**
 * published_at の zod schema。
 *
 * 3 つの受理形式のうち少なくとも 1 つに match する文字列のみ通す。
 * パース後の値は **入力文字列そのまま** とし、ISO 変換・正規化を行わない。
 *
 * これは Zenn Connect が現状 "YYYY-MM-DD HH:mm" を採用しているため、
 * byte 単位で入力を保持しないと、articles/ 側への書き戻し (PR-B 以降)
 * で表記が勝手に変わってしまう副作用を避ける狙い。
 */
export const publishedAtSchema = z
  .string({
    required_error: PUBLISHED_AT_FORMAT_ERROR_MESSAGE,
    invalid_type_error: PUBLISHED_AT_FORMAT_ERROR_MESSAGE,
  })
  .refine(
    (value) => ACCEPTED_PUBLISHED_AT_PATTERNS.some((p) => p.test(value)),
    { message: PUBLISHED_AT_FORMAT_ERROR_MESSAGE },
  )

/**
 * 外部から参照する、published_at の静的型。
 *
 * `z.infer` による値レベルの推論で、実態は `string` と等価だが、schema を
 * そのまま用いることで「検証済み」であることを名前空間上で区別する。
 */
export type PublishedAt = z.infer<typeof publishedAtSchema>
