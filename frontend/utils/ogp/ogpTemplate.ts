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
import { OGP_IMAGE_HEIGHT, OGP_IMAGE_WIDTH } from '../../constants/ogp'
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

/**
 * OGP の画像サイズ (幅)。
 *
 * 真値は `constants/ogp.ts` (`OGP_IMAGE_WIDTH`) に置く。本モジュールでは
 * 既存の import 経路 (`from './ogpTemplate'`) を破壊しないために
 * re-export を残してある。設計 v2 Step 9。
 */
export const OGP_WIDTH = OGP_IMAGE_WIDTH

/**
 * OGP の画像サイズ (高さ)。
 * 真値は `constants/ogp.ts` (`OGP_IMAGE_HEIGHT`)。
 */
export const OGP_HEIGHT = OGP_IMAGE_HEIGHT

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
 * footer に焼き込むロゴ (`<img>`) の幅 (px)。
 *
 * 元画像のアスペクト比 500:263 (~ 1.9:1) を保ったまま 96x50 に
 * 縮める。footer の高さ (FOOTER_FONT_SIZE = 28px) を大きく超えない
 * 範囲で視認性を確保する。
 */
const OGP_LOGO_WIDTH = 96

/** footer に焼き込むロゴの高さ (px)。500:263 比を維持して算出 */
const OGP_LOGO_HEIGHT = 50

/**
 * `createOgpElement` の任意オプション。
 */
export interface CreateOgpElementOptions {
  /**
   * footer 右端に焼き込むロゴ画像の data URI。
   *
   * - null / undefined: ロゴなし (既存 2-cell footer)
   * - 文字列: `<img src={...}>` を footer 右端 (3 つ目の cell) に追加
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

  // ロゴありの場合は中央に日付を寄せ、右端をロゴに譲る。
  // ロゴなしの場合は従来どおり「サイト名 / 日付」の 2 セルを space-between
  // で配置するため、ここでは中央配置の単一セルを生成しておき、
  // children 配列の組み立てで使い分ける。
  const footerDate: SatoriElement = {
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

  // ロゴ要素 (logoDataUri が null/undefined のときは生成しない)
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

  // logo がない場合は 2 セル (左: サイト名 / 右: 日付) で space-between。
  // logo がある場合は 3 セル (左: サイト名 / 中: 日付 / 右: ロゴ) で
  // space-between とし、それぞれが両端 / 中央に置かれる。
  const footerChildren: SatoriElement[] = footerLogo
    ? [footerLeft, footerDate, footerLogo]
    : [footerLeft, footerDate]

  const footerRow: SatoriElement = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
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
