/**
 * `utils/ogp/wrapOgpTitle.ts` のユニットテスト。
 *
 * フォントの実 metrics を持たず近似モデルで折り返す純関数なので、
 * 「特定 atom が同一行に残る」「禁則文字が行頭に来ない」等の構造的
 * 性質を中心にアサートする。具体的なピクセル幅の正確さは Satori
 * 側の責務として検証しない。
 */
import { describe, expect, it } from 'vitest'
import { wrapOgpTitle } from '../../../utils/ogp/wrapOgpTitle'
import { toSafeText } from '../../../types/ogp-input'

/**
 * 実テンプレートで使う幅と同等の値。
 * `OGP_IMAGE_WIDTH - ACCENT_WIDTH - CONTENT_PADDING * 2` =
 * 1200 - 32 - 80 * 2 = 1008
 */
const CONTENT_WIDTH_PX = 1008

const OPTS = { contentWidthPx: CONTENT_WIDTH_PX }

const FORBIDDEN_LINE_START_CASES = [
  '」',
  '』',
  '）',
  ']',
  '、',
  '。',
  '！',
  '？',
  '・',
  '…',
  'ー',
] as const

describe('wrapOgpTitle', () => {
  it('returns a single line at 64px for short titles', () => {
    const result = wrapOgpTitle(toSafeText('短いタイトル', 120), OPTS)
    expect(result.fontSizePx).toBe(64)
    expect(result.lines.length).toBe(1)
    expect(result.lines[0]).toBe('短いタイトル')
  })

  it('returns one empty line at the largest font size for empty input', () => {
    // toSafeText は trim するため、入力が空文字なら length === 0 の SafeText が
    // 返る。早期 return パスを検証する。
    const result = wrapOgpTitle(toSafeText('', 120), OPTS)
    expect(result.fontSizePx).toBe(64)
    expect(result.lines).toEqual([''])
  })

  it('does not throw on punctuation-only input', () => {
    expect(() => wrapOgpTitle(toSafeText('。。。', 120), OPTS)).not.toThrow()
  })

  it('breaks after 。 (sentence terminator)', () => {
    // 「最初の文。次の文。」を 64px 幅で十分入る長さで構成し、
    // 句点直後で atom 分割されて 2 つ目の atom が存在することを確認する。
    // 「全行を join した文字列」に 2 つの句点が両方残ること、
    // および 「。」で終わる行が少なくとも 1 つ存在すること、で検証する。
    const result = wrapOgpTitle(
      toSafeText('最初の文。次の文。最後の文。', 120),
      { contentWidthPx: 200 }, // 句点ごとに改行が発生する程度に狭く
    )
    const joined = result.lines.join('')
    expect(joined.split('。').length - 1).toBe(3)
    // どの行も末尾が「。」になっているはず (atom 分割が句点直後で切るため)
    for (const line of result.lines.slice(0, -1)) {
      expect(line.endsWith('。')).toBe(true)
    }
  })

  it('breaks before 「 (opening quote)', () => {
    const result = wrapOgpTitle(
      toSafeText('前の話「鍵括弧の中身」のあと', 120),
      { contentWidthPx: 200 },
    )
    // 「で始まる行が少なくとも 1 つあること
    const hasLineStartingWithOpenBracket = result.lines.some((l) =>
      l.startsWith('「'),
    )
    expect(hasLineStartingWithOpenBracket).toBe(true)
  })

  it.each(FORBIDDEN_LINE_START_CASES)(
    'never places %s at the line start',
    (forbidden) => {
      // 禁則文字を含むタイトルを複数バリエーションで折り返し、いずれの行頭
      // にも該当文字が来ないことを確認する。文脈は CJK で固める。
      const titles = [
        `あいう${forbidden}えお かきく${forbidden}けこ さしす${forbidden}せそ たちつ${forbidden}てと`,
        `テスト${forbidden}データ${forbidden}サンプル${forbidden}ケース${forbidden}検証${forbidden}文字列`,
      ]
      for (const raw of titles) {
        const result = wrapOgpTitle(toSafeText(raw, 120), {
          contentWidthPx: 240,
        })
        for (const line of result.lines) {
          expect(line.startsWith(forbidden)).toBe(false)
        }
      }
    },
  )

  it('breaks at ASCII <-> CJK boundary', () => {
    const result = wrapOgpTitle(
      toSafeText('日本語ai-rotomを使う', 120),
      OPTS,
    )
    // 全行を join した文字列に元の文字列が含まれること (情報損失なし)
    expect(result.lines.join('')).toBe('日本語ai-rotomを使う')
  })

  it('keeps ASCII words like ai-rotom intact on a single line when possible', () => {
    // 1 行に余裕がある幅では `ai-rotom` の途中で割ってはならない。
    const result = wrapOgpTitle(toSafeText('ai-rotom', 120), OPTS)
    expect(result.lines.length).toBe(1)
    expect(result.lines[0]).toBe('ai-rotom')
  })

  it('does not split ai-rotom in the middle even under tight width', () => {
    // 幅を絞っても `ai-rotom` 単体は 1 atom として残る (= どの行にも分割形が
    // 現れない)。
    const result = wrapOgpTitle(
      toSafeText('日本語の前置きが長いタイトルai-rotomで終わる話', 120),
      { contentWidthPx: 220 },
    )
    const joined = result.lines.join('|')
    expect(joined).toContain('ai-rotom')
    // `ai-rotom` の一部だけが行頭/行末に残るような割れ方は防ぎたい
    for (const line of result.lines) {
      // 「ai-rotom」の prefix である「ai」「ai-」「ai-r」等で終わる行があれば
      // それは ASCII atom の途中で割れている。
      expect(line.endsWith('ai')).toBe(false)
      expect(line.endsWith('ai-')).toBe(false)
      expect(line.endsWith('ai-r')).toBe(false)
      expect(line.endsWith('ai-ro')).toBe(false)
      expect(line.endsWith('ai-rot')).toBe(false)
      expect(line.endsWith('ai-roto')).toBe(false)
    }
  })

  it('does not leave a leading space when input had consecutive spaces', () => {
    const result = wrapOgpTitle(toSafeText('foo   bar', 120), OPTS)
    for (const line of result.lines) {
      expect(line.startsWith(' ')).toBe(false)
    }
  })

  it('handles fullwidth->ASCII boundary', () => {
    const result = wrapOgpTitle(toSafeText('日本語abc混在', 120), OPTS)
    expect(result.lines.join('')).toBe('日本語abc混在')
  })

  it('handles ASCII->fullwidth boundary', () => {
    const result = wrapOgpTitle(toSafeText('abc日本語混在', 120), OPTS)
    expect(result.lines.join('')).toBe('abc日本語混在')
  })

  it('treats digits as ASCII', () => {
    const result = wrapOgpTitle(toSafeText('日本語123混在', 120), OPTS)
    expect(result.lines.join('')).toBe('日本語123混在')
  })

  it('drops down to 48px for medium-length titles that overflow 2 lines at 64px', () => {
    // 64px で 2 行に収まらず、48px なら 4 行までに収まるサイズ感のタイトル。
    // CJK のみ 50 字程度を流し込む。
    const longish = 'あ'.repeat(50)
    const result = wrapOgpTitle(toSafeText(longish, 120), OPTS)
    expect(result.fontSizePx).toBe(48)
  })

  it('drops down to 32px for very long titles', () => {
    const veryLong = 'あ'.repeat(100)
    const result = wrapOgpTitle(toSafeText(veryLong, 120), OPTS)
    expect(result.fontSizePx).toBe(32)
  })

  it('falls back to ellipsis when even 32px cannot fit 8 lines', () => {
    // 32px 8 行を確実に超過させるため、利用可能幅を極端に狭めて 1 行 5 字
    // 程度しか入らない状況で 120 字を流し込む。
    const result = wrapOgpTitle(toSafeText('あ'.repeat(120), 120), {
      contentWidthPx: 200,
    })
    expect(result.fontSizePx).toBe(32)
    expect(result.lines.length).toBeLessThanOrEqual(8)
    const last = result.lines[result.lines.length - 1]
    expect(last.endsWith('…')).toBe(true)
  })

  it('survives a single oversized atom (e.g. 200-char ASCII run)', () => {
    // 1 atom (= ASCII 連続) が単独で利用可能幅を超える場合の救済パス。
    // crash せず、なんらかの行に収まることだけ確認する。
    const result = wrapOgpTitle(toSafeText('a'.repeat(200), 120), OPTS)
    expect(result.lines.length).toBeGreaterThanOrEqual(1)
    // 何らかの形で 'a' を含んでいる
    expect(result.lines.join('')).toContain('a')
  })

  it('does not split an emoji codepoint (surrogate pair safety)', () => {
    // 🧪 は U+1F9EA (サロゲートペア)。Array.from で 1 codepoint 扱いになる。
    const result = wrapOgpTitle(toSafeText('🧪', 120), OPTS)
    expect(result.lines.length).toBe(1)
    expect(result.lines[0]).toBe('🧪')
  })

  it('does not introduce characters that were not in the input', () => {
    // 入力に存在しない文字 (… 以外) を出力に混入させないこと。
    // ellipsis フォールバックが起きない短いケースで検証する。
    const raw = 'これはテスト「サンプル」です。ai-rotomを使う'
    const result = wrapOgpTitle(toSafeText(raw, 120), OPTS)
    const inputChars = new Set(Array.from(raw))
    // 半角スペースは splitIntoAtoms で消費されるので set に追加してもしなくても
    // テスト対象 (join 結果) には影響しない (出力に空白を埋め戻していないため)
    for (const ch of result.lines.join('')) {
      expect(inputChars.has(ch)).toBe(true)
    }
  })

  it('selects 64px at the 2-line boundary (just-fits case)', () => {
    // 64px 利用可能幅 (1008 * 0.95 = 957.6) の場合、CJK 14 字 (= 896px) までは
    // 1 行に収まる。20 字なら 14 + 6 = 2 行で 64px の許容に入る。
    const result = wrapOgpTitle(toSafeText('あ'.repeat(20), 120), OPTS)
    expect(result.fontSizePx).toBe(64)
    expect(result.lines.length).toBeLessThanOrEqual(2)
  })

  it('never emits control characters in the output lines', () => {
    // SafeText 不変条件のうち「制御文字を含まない」を property として固定する。
    // 入口 (toSafeText) で除去される前提だが、将来 wrapOgpTitle 内部で
    // 区切り文字を追加する変更が入ったときに再発を防ぐ。
    const samples = [
      '短いタイトル',
      '育成論はAIと並走する時代へ。ポケモンバトル',
      'a-b-c-d-e f-g-h-i-j',
      'あ'.repeat(120),
      '。'.repeat(60),
    ]
    for (const raw of samples) {
      const result = wrapOgpTitle(toSafeText(raw, 120), OPTS)
      for (const ch of result.lines.join('')) {
        const cp = ch.codePointAt(0) ?? 0
        const isC0 = cp <= 0x1f
        const isDelOrC1 = cp >= 0x7f && cp <= 0x9f
        expect(isC0 || isDelOrC1).toBe(false)
      }
    }
  })

  it('does not crash on ZWJ emoji sequences', () => {
    // 結合絵文字 (例: 👨‍👩‍👧‍👦 = 4 顔 + 3 ZWJ) は wrapOgpTitle の単位では
    // 複数 codepoint に分かれて見えるが、crash させずに何らかの形で行に収める。
    // grapheme cluster の保全はスコープ外 (描画品質課題) として明示する。
    const zwjFamily = '👨‍👩‍👧‍👦'
    const result = wrapOgpTitle(toSafeText(`家族${zwjFamily}と外出`, 120), OPTS)
    expect(result.lines.length).toBeGreaterThanOrEqual(1)
    expect(result.lines.join('').length).toBeGreaterThan(0)
  })
})
