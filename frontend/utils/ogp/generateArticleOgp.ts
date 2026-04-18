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
import {
  createOgpElement,
  OGP_HEIGHT,
  OGP_WIDTH,
} from './ogpTemplate'

/** Satori に渡すフォント設定のデフォルト値 */
const DEFAULT_FONT_NAME = 'Noto Sans JP'
const DEFAULT_FONT_WEIGHT = 400
const DEFAULT_FONT_STYLE = 'normal' as const

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
  const width = options.width ?? OGP_WIDTH
  const height = options.height ?? OGP_HEIGHT
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
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  })
  const pngData = resvg.render()
  return pngData.asPng()
}
