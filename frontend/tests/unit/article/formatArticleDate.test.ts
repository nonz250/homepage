import { describe, expect, it } from 'vitest'
import { formatPublishedDate } from '../../../utils/article/formatArticleDate'

/**
 * `formatPublishedDate` の単体テスト。
 *
 * UI で表示する日付文字列化ロジックの境界 (undefined / 空文字 / 不正値 /
 * 正常値) を固定する。タイムゾーン変換は行わない仕様のため、
 * 入力の先頭 10 文字がそのまま返ることを確認する。
 */
describe('formatPublishedDate', () => {
  it('returns empty string when input is undefined', () => {
    expect(formatPublishedDate(undefined)).toBe('')
  })

  it('returns empty string for an empty string input', () => {
    expect(formatPublishedDate('')).toBe('')
  })

  it('returns empty string when input cannot be parsed as a date', () => {
    expect(formatPublishedDate('not-a-date')).toBe('')
  })

  it('returns the YYYY-MM-DD prefix for an ISO8601 value with offset', () => {
    expect(formatPublishedDate('2026-04-17T12:00:00+09:00')).toBe('2026-04-17')
  })

  it('returns the YYYY-MM-DD prefix for a UTC ISO8601 value', () => {
    expect(formatPublishedDate('2026-04-15T00:00:00Z')).toBe('2026-04-15')
  })
})
