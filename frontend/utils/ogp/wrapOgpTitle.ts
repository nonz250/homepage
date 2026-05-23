/**
 * OGP タイトルを描画用に折り返す純関数。
 *
 * Satori は `-webkit-line-clamp` で 2 行に切り詰めて末尾を `…` にできるが、
 * 全文を見せたい要件 (長いタイトルでも省略させない) には合わない。本関数は
 * フォントサイズ候補を順番に試し、許容行数に収まる最大サイズで「単語境界」
 * での greedy pack を行って lines を返す。
 *
 * フォント幅は実フォント計測なしで近似する (Satori 描画前に呼ぶので CSS の
 * font metrics を取れない)。CJK は全角幅、ASCII は半角幅として `fontSizePx`
 * に倍率を掛けた値を 1 文字あたりの幅とみなす。実描画はプロポーショナルだが、
 * 多少の余白で吸収するため `SAFE_WIDTH_RATIO` を掛けて利用可能幅を狭める。
 *
 * 分割は atom 単位 (= 不可分な文字塊) で行う。atom 分割の break opportunity
 * は次のとおり:
 *   - `。、！？` の直後
 *   - `「『（[` の直前
 *   - `」』）]` の直後
 *   - 半角スペース (atom には含めず純粋な区切りとして消費)
 *   - 全角 ↔ 半角 (CJK ↔ ASCII) の境界
 *
 * atom 内で不可分扱いするもの:
 *   - ASCII 英数字 + `-` `_` `.` 等の連続 (例: `ai-rotom` は 1 atom。実装上は
 *     code point < 0x80 を全部 ASCII kind に含めることで達成する)
 *   - CJK 連続 (約物以外) は 1 atom
 *
 * 行頭禁則: 「`」』）]、。！？・…ー`」 を行頭に置かない。前の行末にぶら下げる。
 */
import type { SafeText } from '../../types/ogp-input'

/** タイトル描画に試すフォントサイズ候補 (px、大きい順) */
const OGP_TITLE_FONT_SIZES_PX = [64, 48, 32] as const

/** 各フォントサイズで許容する最大行数。OGP_TITLE_FONT_SIZES_PX と同 index で対応 */
const OGP_TITLE_MAX_LINES_PER_SIZE = [2, 4, 8] as const

/** line-height (font-size に対する倍率) */
export const OGP_TITLE_LINE_HEIGHT_RATIO = 1.3

/** 利用可能幅 (contentWidthPx) に掛ける安全側マージン */
const SAFE_WIDTH_RATIO = 0.95

/** ASCII 1 文字の推定幅 (fontSizePx に対する倍率) */
const ASCII_WIDTH_RATIO = 0.55

/** CJK・全角 1 文字の推定幅 (fontSizePx に対する倍率) */
const FULLWIDTH_WIDTH_RATIO = 1.0

/** ellipsis フォールバック時に末尾に挿入する文字 (HORIZONTAL ELLIPSIS) */
const ELLIPSIS_CHAR = '…'

/** 行頭禁則対象。前の行末にぶら下げる */
const FORBIDDEN_LINE_START_CHARS = '」』）]、。！？・…ー'

/** atom 分割の break-after 集合 (この文字の直後で切れる) */
const BREAK_AFTER_CHARS = '。、！？'

/** atom 分割の break-before 集合 (この文字の直前で切れる) */
const BREAK_BEFORE_CHARS = '「『（['

/** atom 分割の break-after 集合 (閉じ括弧。閉じた直後で切れる) */
const CLOSING_BRACKET_CHARS = '」』）]'

/** 半角スペース。atom には含めず区切りとして消費する */
const SPACE_CHAR = ' '

export interface WrapOgpTitleOpts {
  /** タイトル描画に使える幅 (px)。テンプレが accent/padding を引いた値を渡す */
  readonly contentWidthPx: number
}

export interface WrapOgpTitleResult {
  readonly lines: readonly SafeText[]
  readonly fontSizePx: number
}

/**
 * SafeText を fontSizePx で折り返す。
 *
 * @param title サニタイズ済みタイトル
 * @param opts 利用可能な描画幅
 * @returns 各行 (SafeText) と採用したフォントサイズ
 */
export function wrapOgpTitle(
  title: SafeText,
  opts: WrapOgpTitleOpts,
): WrapOgpTitleResult {
  if (title.length === 0) {
    return {
      lines: ['' as SafeText],
      fontSizePx: OGP_TITLE_FONT_SIZES_PX[0],
    }
  }

  const atoms = splitIntoAtoms(title)

  for (let i = 0; i < OGP_TITLE_FONT_SIZES_PX.length; i++) {
    const fontSizePx = OGP_TITLE_FONT_SIZES_PX[i]
    const maxLines = OGP_TITLE_MAX_LINES_PER_SIZE[i]
    const availableWidthPx = opts.contentWidthPx * SAFE_WIDTH_RATIO
    const lines = packAtomsIntoLines(atoms, fontSizePx, availableWidthPx)
    if (lines.length <= maxLines) {
      // 各 line は SafeText 由来の substring/concat なので、制御文字混入の
      // 不変条件は維持される。brand 型へは unknown 経由で再封入する。
      return { lines: lines as unknown as readonly SafeText[], fontSizePx }
    }
  }

  // フロアサイズでも収まらないケース。最終手段として末尾を ellipsis で
  // 切り詰める。SafeText の不変条件 (制御文字なし) は維持される (… は U+2026)。
  const floorFontSizePx =
    OGP_TITLE_FONT_SIZES_PX[OGP_TITLE_FONT_SIZES_PX.length - 1]
  const floorMaxLines =
    OGP_TITLE_MAX_LINES_PER_SIZE[OGP_TITLE_MAX_LINES_PER_SIZE.length - 1]
  const availableWidthPx = opts.contentWidthPx * SAFE_WIDTH_RATIO
  const lines = packAtomsIntoLines(atoms, floorFontSizePx, availableWidthPx)
  const truncated = lines.slice(0, floorMaxLines)
  const last = truncated[truncated.length - 1] ?? ''
  truncated[truncated.length - 1] = appendEllipsis(last)
  return {
    lines: truncated as unknown as readonly SafeText[],
    fontSizePx: floorFontSizePx,
  }
}

type AtomKind = 'ascii' | 'cjk'

/**
 * 文字列を atom 列に分解する。
 *
 * atom はそれ以上分割しない最小単位。半角スペースは atom には含めず捨てる
 * (連続スペースも 1 つの区切りと等価)。
 */
function splitIntoAtoms(text: string): string[] {
  const codepoints = Array.from(text)
  const atoms: string[] = []
  let buf = ''
  let bufKind: AtomKind | null = null

  const flush = (): void => {
    if (buf.length > 0) {
      atoms.push(buf)
      buf = ''
      bufKind = null
    }
  }

  for (let i = 0; i < codepoints.length; i++) {
    const ch = codepoints[i]

    if (ch === SPACE_CHAR) {
      flush()
      continue
    }

    if (BREAK_BEFORE_CHARS.includes(ch)) {
      flush()
      buf = ch
      bufKind = classifyChar(ch)
      continue
    }

    const kind = classifyChar(ch)
    if (bufKind !== null && bufKind !== kind) {
      flush()
    }
    buf += ch
    bufKind = kind

    if (BREAK_AFTER_CHARS.includes(ch) || CLOSING_BRACKET_CHARS.includes(ch)) {
      flush()
    }
  }
  flush()
  return atoms
}

function classifyChar(ch: string): AtomKind {
  const cp = ch.codePointAt(0) ?? 0
  // ASCII 範囲 (0x00-0x7F) は英数字も `-` `_` `.` 等の連結子も等しく 1 atom に
  // まとめたいので一括で ascii kind とする。`ai-rotom` のような ASCII 語の中で
  // ハイフンを挟んでも 1 atom になる。
  if (cp < 0x80) {
    return 'ascii'
  }
  return 'cjk'
}

/**
 * atom 列を fontSizePx に対する availableWidthPx に収まる行配列にパックする。
 *
 * greedy: 各行に入るだけ atom を詰め、入らなくなったら改行する。
 * 行頭禁則: 直前の行末が空でなく、現 atom の先頭が禁則文字なら前行に
 * ぶら下げる。
 */
function packAtomsIntoLines(
  atoms: readonly string[],
  fontSizePx: number,
  availableWidthPx: number,
): string[] {
  const lines: string[] = []
  let current = ''

  const widthOf = (s: string): number => estimateWidthPx(s, fontSizePx)

  const pushOversized = (atom: string): void => {
    // atom 単独で利用可能幅を超える場合の救済。pieces[0..n-2] を確定行として
    // emit し、最終 piece を新たな current にする (current は呼び出し元で更新)。
    const pieces = splitOversizedAtom(atom, fontSizePx, availableWidthPx)
    for (let k = 0; k < pieces.length - 1; k++) {
      lines.push(pieces[k])
    }
    current = pieces[pieces.length - 1]
  }

  for (const atom of atoms) {
    if (widthOf(atom) > availableWidthPx) {
      // 単独で幅を超える atom: 現在行をまず確定 (空でなければ) → 強制分割。
      // これにより current が「単独で超過したまま」次の atom と結合される
      // バグを避ける。
      if (current.length > 0) {
        lines.push(current)
        current = ''
      }
      pushOversized(atom)
      continue
    }

    const candidate = current + atom
    if (widthOf(candidate) <= availableWidthPx) {
      current = candidate
      continue
    }

    if (
      atom.length > 0 &&
      FORBIDDEN_LINE_START_CHARS.includes(atom[0])
    ) {
      // 行頭禁則: 改行せず、利用可能幅を多少超えても前行にぶら下げる。
      current = candidate
      continue
    }

    lines.push(current)
    current = atom
  }
  if (current.length > 0) {
    lines.push(current)
  }
  return lines
}

/**
 * 単独 atom が利用可能幅を超える場合の救済。
 *
 * codepoint 単位で利用可能幅以内になるまで切る。`Array.from` で
 * サロゲートペアを壊さない単位に分解する。
 *
 * 行頭禁則: 強制分割の境界の右側 (= 次行先頭) に禁則文字が来そうな
 * ときは buf に取り込んでぶら下げ、境界を 1 字後ろにずらす。
 */
function splitOversizedAtom(
  atom: string,
  fontSizePx: number,
  availableWidthPx: number,
): string[] {
  const codepoints = Array.from(atom)
  const pieces: string[] = []
  let buf = ''
  for (const ch of codepoints) {
    const candidate = buf + ch
    const overflow =
      estimateWidthPx(candidate, fontSizePx) > availableWidthPx && buf !== ''
    if (overflow && FORBIDDEN_LINE_START_CHARS.includes(ch)) {
      // ch が禁則文字なら buf にぶら下げて境界を遅らせる。
      buf = candidate
      continue
    }
    if (overflow) {
      pieces.push(buf)
      buf = ch
    } else {
      buf = candidate
    }
  }
  if (buf.length > 0) {
    pieces.push(buf)
  }
  return pieces
}

/**
 * 文字列の描画幅を概算する (px)。
 *
 * code point < 0x80 を ASCII 半角扱い、それ以外を全角扱いとする単純モデル。
 * 厳密な metrics は Satori に任せ、ここでは「収まるかどうか」の二値判定で
 * 使うため近似で十分。
 */
function estimateWidthPx(text: string, fontSizePx: number): number {
  let widthPx = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    const ratio = cp < 0x80 ? ASCII_WIDTH_RATIO : FULLWIDTH_WIDTH_RATIO
    widthPx += fontSizePx * ratio
  }
  return widthPx
}

/**
 * 行末を ellipsis (`…`) で 1 文字置き換えた string を返す。
 *
 * 元 string が空なら ellipsis 単体を返す。codepoint 単位で扱うため
 * サロゲートペアを壊さない。
 */
function appendEllipsis(line: string): string {
  if (line.length === 0) return ELLIPSIS_CHAR
  const codepoints = Array.from(line)
  if (codepoints.length === 0) return ELLIPSIS_CHAR
  return codepoints.slice(0, codepoints.length - 1).join('') + ELLIPSIS_CHAR
}
