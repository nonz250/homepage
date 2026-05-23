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
 *   - 中央: タイトル (`wrapOgpTitle` で算出した行ごとに `<div>` を並べる)
 *   - 左下: サイト名 (Nozomi Hosaka)
 *   - 右下: ロゴアイコン (square)
 */
import { SITE_TITLE } from '../../constants/rss'
import { OGP_IMAGE_HEIGHT, OGP_IMAGE_WIDTH } from '../../constants/ogp'
import type { SafeOgpInput } from '../../types/ogp-input'
import {
  wrapOgpTitle,
  OGP_TITLE_LINE_HEIGHT_RATIO,
} from './wrapOgpTitle'

/** Satori が受け付ける element オブジェクトの最小型 */
export interface SatoriElement {
  readonly type: string
  readonly props: {
    readonly children?: SatoriElement | string | readonly (SatoriElement | string)[]
    readonly style?: Record<string, string | number>
    readonly [key: string]: unknown
  }
}

/**
 * 左端アクセント線の色 (テーマカラー / nons-labo ブランドカラー)。
 *
 * 設計 v2 Step 22 で `#2563eb` から nons-labo の色 `#3d50b7` に切り替えた。
 */
const ACCENT_COLOR = '#3d50b7'

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

/** 絵文字のフォントサイズ (px) */
const EMOJI_FONT_SIZE = 96

/** サイト名のフォントサイズ (px) */
const FOOTER_FONT_SIZE = 28

/** footer に焼き込むロゴ (`<img>`) の幅 (px)。square アイコン (1024x1024) を縮小 */
const OGP_LOGO_WIDTH = 128

/** footer に焼き込むロゴの高さ (px)。square なので幅と同値 */
const OGP_LOGO_HEIGHT = 128

/**
 * `createOgpElement` の任意オプション。
 */
export interface CreateOgpElementOptions {
  /**
   * footer 右端に焼き込むロゴ画像の data URI。
   *
   * - null / undefined: ロゴなし (1 セルだけの footer)
   * - 文字列: `<img src={...}>` を footer 右端 (2 つ目の cell) に追加
   *
   * caller (`generateArticleOgp`) は `normalizeLogoDataUri` で
   * 検証済みの値を渡すこと。テンプレート側では prefix チェックを
   * 行わない (二重検証コストの回避と SRP)。
   */
  readonly logoDataUri?: string | null
}

/**
 * Satori 用の element ツリーを構築する純関数。
 *
 * 戻り値はそのまま `satori(element, options)` に渡せる。
 *
 * @param input サニタイズ済みの入力
 * @param options 任意の追加オプション (logo data URI など)
 * @returns Satori 用の element (React.createElement 相当のオブジェクト)
 */
export function createOgpElement(
  input: SafeOgpInput,
  options?: CreateOgpElementOptions,
): SatoriElement {
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

  const titleContentWidthPx =
    OGP_IMAGE_WIDTH - ACCENT_WIDTH - CONTENT_PADDING * 2
  const wrapped = wrapOgpTitle(input.title, {
    contentWidthPx: titleContentWidthPx,
  })
  const titleLineHeightPx = Math.round(
    wrapped.fontSizePx * OGP_TITLE_LINE_HEIGHT_RATIO,
  )
  const titleLineElements: SatoriElement[] = wrapped.lines.map((line) => ({
    type: 'div',
    props: {
      style: {
        fontSize: `${wrapped.fontSizePx}px`,
        fontWeight: 700,
        lineHeight: `${titleLineHeightPx}px`,
        color: TEXT_COLOR,
      },
      children: line,
    },
  }))
  const titleBlock: SatoriElement = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
      },
      children: titleLineElements,
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

  const logoDataUri = options?.logoDataUri ?? null
  const footerLogo: SatoriElement | null = logoDataUri
    ? {
        type: 'img',
        props: {
          src: logoDataUri,
          width: OGP_LOGO_WIDTH,
          height: OGP_LOGO_HEIGHT,
          style: {
            // Satori の <img> は明示的に width/height を持たせると
            // 寸法を反映する。display flex 配下で歪まないよう
            // object-fit: contain で安全側に倒す。
            objectFit: 'contain',
          },
        },
      }
    : null

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

  const footerChildren: SatoriElement[] = footerLogo
    ? [footerLeft, footerLogo]
    : [footerLeft]

  const footerRow: SatoriElement = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: footerLogo ? 'space-between' : 'flex-start',
        alignItems: 'center',
      },
      children: footerChildren,
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
        width: `${OGP_IMAGE_WIDTH}px`,
        height: `${OGP_IMAGE_HEIGHT}px`,
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
