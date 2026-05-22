import { describe, it, expect } from 'vitest'
import { normalizeMetaContent } from '~/utils/seo/normalizeMetaContent'

describe('normalizeMetaContent', () => {
  it('改行を半角スペースに置換する', () => {
    expect(normalizeMetaContent('一行目\n二行目')).toBe('一行目 二行目')
  })

  it('CRLF も半角スペースに置換する', () => {
    expect(normalizeMetaContent('一行目\r\n二行目')).toBe('一行目 二行目')
  })

  it('連続する空白を 1 つに圧縮する', () => {
    expect(normalizeMetaContent('a   b\t\tc\n\nd')).toBe('a b c d')
  })

  it('両端の空白を取り除く', () => {
    expect(normalizeMetaContent('  abc  ')).toBe('abc')
  })

  it('空文字列はそのまま返す', () => {
    expect(normalizeMetaContent('')).toBe('')
  })

  it('空白だけの文字列は空文字列に正規化される', () => {
    expect(normalizeMetaContent('   \n\t  ')).toBe('')
  })

  it('改行を含まない通常の文字列はそのまま返す', () => {
    expect(normalizeMetaContent('普通の説明文')).toBe('普通の説明文')
  })
})
