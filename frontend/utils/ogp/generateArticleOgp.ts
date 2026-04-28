/**
 * 記事個別 OGP 画像 (PNG) を生成する純関数。
 *
 * 責務:
 *   1. `SafeOgpInput` から固定レイアウトの element ツリーを構築
 *   2. Satori で SVG に変換
 *   3. resvg-js で PNG にラスタライズ
 *   4. PNG バイト列 (Buffer) を返す
 *
 * ビルド時 (Nuxt の `nitro:build:public-assets` hook) から呼ばれる想定で、
 * caller が font buffer を読み込んで渡す (I/O を純関数側に持たせない)。
 *
 * 設計 v4 5.2 節 / Batch B 参照。
 */
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import type { SafeOgpInput } from '../../types/ogp-input'
import { createOgpElement } from './ogpTemplate'
import { OGP_IMAGE_HEIGHT, OGP_IMAGE_WIDTH } from '../../constants/ogp'
import { loadTwemojiSvg } from './loadTwemojiSvg'

/** Satori に渡すフォント設定のデフォルト値 */
const DEFAULT_FONT_NAME = 'Noto Sans JP'
const DEFAULT_FONT_WEIGHT = 400
const DEFAULT_FONT_STYLE = 'normal' as const

/**
 * Satori の `loadAdditionalAsset` で `code === 'emoji'` 時に渡される定数。
 * それ以外 (言語コード等) ではフォールバックして segment をそのまま返す。
 */
const EMOJI_LANGUAGE_CODE = 'emoji'

/**
 * `generateArticleOgp` のオプション。
 *
 * 現状は caller から font buffer だけ渡してもらえば十分で、他はデフォルト
 * 固定だが、将来テーマやサイズを切り替える余地として interface に昇格させる。
 */
export interface GenerateArticleOgpOptions {
  /** Satori に渡すフォントバッファ (TTF/OTF/WOFF。WOFF2 は非対応) */
  readonly fontBuffer: Buffer
  /** フォント名 (Satori のスタイル解決に利用) */
  readonly fontName?: string
  /** 画像の幅 (テスト時のオーバーライド用) */
  readonly width?: number
  /** 画像の高さ (テスト時のオーバーライド用) */
  readonly height?: number
}

/**
 * 記事 OGP PNG を生成する。
 *
 * @param input サニタイズ済みの入力
 * @param options font buffer と任意のオーバーライド
 * @returns PNG バイト列 (Buffer)
 */
export async function generateArticleOgp(
  input: SafeOgpInput,
  options: GenerateArticleOgpOptions,
): Promise<Buffer> {
  const width = options.width ?? OGP_IMAGE_WIDTH
  const height = options.height ?? OGP_IMAGE_HEIGHT
  const fontName = options.fontName ?? DEFAULT_FONT_NAME

  const element = createOgpElement(input)

  // Satori は `element` として JSX でも、プレーンオブジェクトでも受け付ける。
  // ここではオブジェクト形式で渡している。
  // 型は `React.ReactElement` を要求するため、構造的に互換である本オブジェクトに
  // 対しては cast が必要。Satori 側の実装は `type` と `props` しか見ないため
  // 実行時には問題が起きない。
  const svg = await satori(element as unknown as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: [
      {
        name: fontName,
        data: options.fontBuffer,
        weight: DEFAULT_FONT_WEIGHT,
        style: DEFAULT_FONT_STYLE,
      },
    ],
    // Noto Sans JP のサブセットには絵文字グリフが含まれない (本文対応のため
    // 意図的に落としている)。Satori が絵文字セグメントを検出したら、ここで
    // Twemoji SVG の data URI に差し替えて `<img>` として描画させる。
    // 見つからない絵文字はセグメントをそのまま返し、フォントのフォールバックに
    // 任せる (最悪豆腐表示になるが、build は止めない)。
    loadAdditionalAsset: async (code, segment) => {
      if (code === EMOJI_LANGUAGE_CODE) {
        const twemojiDataUri = await loadTwemojiSvg(segment)
        if (twemojiDataUri !== null) {
          return twemojiDataUri
        }
      }
      return segment
    },
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  })
  const pngData = resvg.render()
  return pngData.asPng()
}
