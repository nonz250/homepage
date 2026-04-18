/**
 * Satori OGP 画像の固定レイアウトテンプレート。
 *
 * Satori は JSX を受け取るが、本プロジェクトは Vue ベースで React ランタイムを
 * 持たないため、JSX を避けて `React.createElement` 相当のプレーンなオブジェクト
 * ツリーを返す純関数として実装する。Satori は `{ type, props: { children, style,
 * ... } }` 形式のオブジェクトを受け付けるため、同じ形を返せば JSX と機能的に等価
 * である。
 *
 * 設計原則:
 *   - コンテンツ由来の値は **テキスト子要素のみ** に閉じ込め、動的属性
 *     (特に `<img src>`) には一切入れない (設計 v4 Sec M-8)
 *   - 入力は `SafeOgpInput` (brand 型) 限定。事前に `toSafeText` でサニタイズ
 *     されている前提
 *   - スタイルはインラインに固定。Satori は外部 CSS をサポートしない
 *
 * レイアウト (1200x630):
 *   - 背景: 白 (solid color)
 *   - 左端にアクセント縦線 (32px 幅)
 *   - 左上: 絵文字 (emoji があるときのみ)
 *   - 中央: タイトル (2 行まで、ellipsis)
 *   - 左下: サイト名 (Nozomi Hosaka)
 *   - 右下: 日付
 */
import { SITE_TITLE } from '../../constants/rss'
import type { SafeOgpInput } from '../../types/ogp-input'

/** Satori が受け付ける element オブジェクトの最小型 */
export interface SatoriElement {
  readonly type: string
  readonly props: {
    readonly children?: SatoriElement | string | readonly (SatoriElement | string)[]
    readonly style?: Record<string, string | number>
    readonly [key: string]: unknown
  }
}

/** OGP の画像サイズ (幅) */
export const OGP_WIDTH = 1200

/** OGP の画像サイズ (高さ) */
export const OGP_HEIGHT = 630

/** 左端アクセント線の色 (テーマカラー) */
const ACCENT_COLOR = '#2563eb'

/** 背景色 */
const BACKGROUND_COLOR = '#ffffff'

/** テキスト色 (本文) */
const TEXT_COLOR = '#0f172a'

/** テキスト色 (補助) */
const MUTED_TEXT_COLOR = '#64748b'

/** 左端アクセント線の幅 (px) */
const ACCENT_WIDTH = 32

/** 全体のパディング (px) */
const CONTENT_PADDING = 80

/** タイトルのフォントサイズ (px) */
const TITLE_FONT_SIZE = 64

/** 絵文字のフォントサイズ (px) */
const EMOJI_FONT_SIZE = 96

/** サイト名・日付のフォントサイズ (px) */
const FOOTER_FONT_SIZE = 28

/**
 * Satori 用の element ツリーを構築する純関数。
 *
 * 戻り値はそのまま `satori(element, options)` に渡せる。
 *
 * @param input サニタイズ済みの入力
 * @returns Satori 用の element (React.createElement 相当のオブジェクト)
 */
export function createOgpElement(input: SafeOgpInput): SatoriElement {
  const emojiBlock: SatoriElement | null = input.emoji
    ? {
        type: 'div',
        props: {
          style: {
            fontSize: `${EMOJI_FONT_SIZE}px`,
            lineHeight: 1,
          },
          children: input.emoji,
        },
      }
    : null

  const titleBlock: SatoriElement = {
    type: 'div',
    props: {
      style: {
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        fontSize: `${TITLE_FONT_SIZE}px`,
        fontWeight: 700,
        lineHeight: 1.3,
        color: TEXT_COLOR,
        // Satori では `text-overflow: ellipsis` は line-clamp と合わせて働く。
        textOverflow: 'ellipsis',
      },
      children: input.title,
    },
  }

  const footerLeft: SatoriElement = {
    type: 'div',
    props: {
      style: {
        fontSize: `${FOOTER_FONT_SIZE}px`,
        color: MUTED_TEXT_COLOR,
        fontWeight: 500,
      },
      children: SITE_TITLE,
    },
  }

  const footerRight: SatoriElement = {
    type: 'div',
    props: {
      style: {
        fontSize: `${FOOTER_FONT_SIZE}px`,
        color: MUTED_TEXT_COLOR,
        fontWeight: 500,
      },
      children: input.date,
    },
  }

  const mainChildren: (SatoriElement | null)[] = [
    emojiBlock,
    titleBlock,
  ]

  const mainColumn: SatoriElement = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        gap: '32px',
        // title が伸びたときに footer を押し出さないよう min-height 0
        minHeight: 0,
      },
      children: mainChildren.filter(
        (child): child is SatoriElement => child !== null,
      ),
    },
  }

  const footerRow: SatoriElement = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      },
      children: [footerLeft, footerRight],
    },
  }

  const contentColumn: SatoriElement = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: `${CONTENT_PADDING}px`,
        justifyContent: 'space-between',
      },
      children: [mainColumn, footerRow],
    },
  }

  const accentBar: SatoriElement = {
    type: 'div',
    props: {
      style: {
        width: `${ACCENT_WIDTH}px`,
        height: '100%',
        background: ACCENT_COLOR,
      },
      children: '',
    },
  }

  const root: SatoriElement = {
    type: 'div',
    props: {
      style: {
        width: `${OGP_WIDTH}px`,
        height: `${OGP_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'row',
        background: BACKGROUND_COLOR,
        fontFamily: 'Noto Sans JP',
      },
      children: [accentBar, contentColumn],
    },
  }

  return root
}
