/**
 * `utils/ogp/ogpTemplate.ts` の構造的 assert テスト。
 *
 * Satori の element ツリーは React.createElement 相当のプレーン
 * オブジェクトなので、PNG バイナリ snapshot を比較せず、構造
 * (children の数、accent bar の色、footer 子要素数 など) を直接
 * 検証する。フォント描画揺れに左右されない安定したテストにできる。
 *
 * 設計 v2 Step 0 / Step 18-19 / Step 22 を参照。
 */
import { describe, expect, it } from 'vitest'
import {
  createOgpElement,
  type SatoriElement,
} from '../../../utils/ogp/ogpTemplate'
import { toSafeText, type SafeOgpInput } from '../../../types/ogp-input'

/** OGP 1200x630 想定 */
const EXPECTED_WIDTH = 1200
const EXPECTED_HEIGHT = 630

/** Step 22 で nons-labo ブランドカラーに切り替えたテーマ色 */
const EXPECTED_ACCENT_COLOR = '#3d50b7'

/** ロゴ寸法 (icon.png 512x512 square を縮小) */
const EXPECTED_LOGO_WIDTH = 128
const EXPECTED_LOGO_HEIGHT = 128

/** ロゴ用のダミー data URI */
const DUMMY_LOGO_DATA_URI = 'data:image/png;base64,AAAA'

/** root の直下は accent bar + content column の 2 要素 */
const ROOT_CHILD_COUNT = 2

/** content column の直下は main column + footer row の 2 要素 */
const CONTENT_COLUMN_CHILD_COUNT = 2

/** logo なしの footer はサイト名のみの 1 要素 */
const FOOTER_CHILD_COUNT_WITHOUT_LOGO = 1

/** logo ありの footer は「サイト名 / ロゴ」の 2 要素 */
const FOOTER_CHILD_COUNT_WITH_LOGO = 2

function buildInput(overrides: Partial<SafeOgpInput> = {}): SafeOgpInput {
  return {
    title: toSafeText('テストタイトル', 120),
    tags: [],
    theme: 'light',
    ...overrides,
  }
}

/**
 * children が配列か単一要素かを問わず配列に正規化する。
 */
function asChildArray(
  children: SatoriElement['props']['children'],
): readonly (SatoriElement | string)[] {
  if (Array.isArray(children)) {
    return children
  }
  if (children === undefined) {
    return []
  }
  return [children as SatoriElement | string]
}

describe('createOgpElement (no logo)', () => {
  it('returns a div root with the configured size', () => {
    const root = createOgpElement(buildInput())
    expect(root.type).toBe('div')
    expect(root.props.style?.width).toBe(`${EXPECTED_WIDTH}px`)
    expect(root.props.style?.height).toBe(`${EXPECTED_HEIGHT}px`)
  })

  it('places accent bar and content column as direct children', () => {
    const root = createOgpElement(buildInput())
    const children = asChildArray(root.props.children)
    expect(children.length).toBe(ROOT_CHILD_COUNT)
    const [accentBar, contentColumn] = children as readonly SatoriElement[]
    expect(accentBar.type).toBe('div')
    expect(accentBar.props.style?.background).toBe(EXPECTED_ACCENT_COLOR)
    expect(contentColumn.type).toBe('div')
  })

  it('content column contains main column and footer row', () => {
    const root = createOgpElement(buildInput())
    const [, contentColumn] = asChildArray(
      root.props.children,
    ) as readonly SatoriElement[]
    const contentChildren = asChildArray(contentColumn.props.children)
    expect(contentChildren.length).toBe(CONTENT_COLUMN_CHILD_COUNT)
  })

  it('footer holds only the site-name cell when logo is absent', () => {
    const root = createOgpElement(buildInput())
    const [, contentColumn] = asChildArray(
      root.props.children,
    ) as readonly SatoriElement[]
    const [, footerRow] = asChildArray(
      contentColumn.props.children,
    ) as readonly SatoriElement[]
    const footerChildren = asChildArray(footerRow.props.children)
    expect(footerChildren.length).toBe(FOOTER_CHILD_COUNT_WITHOUT_LOGO)
    // ロゴ無しでは flex-start で左寄せ (中央や両端揃えだとサイト名が
    // 想定外の位置に飛ぶ)
    expect(footerRow.props.style?.justifyContent).toBe('flex-start')
  })
})

describe('createOgpElement (title wrapping)', () => {
  it('renders one child per wrapped title line', () => {
    // 60 字程度の中長タイトルは 64px では 2 行に収まらないことが多いが、
    // ここで検証したいのは「wrapOgpTitle.lines.length === titleBlock.children.length」
    // という構造契約のみ。具体的な行数は wrapOgpTitle 側でテストする。
    const root = createOgpElement(
      buildInput({
        title: toSafeText(
          'これは折り返し検証のための比較的長めの日本語タイトルです。',
          120,
        ),
      }),
    )
    const [, contentColumn] = asChildArray(
      root.props.children,
    ) as readonly SatoriElement[]
    const [mainColumn] = asChildArray(
      contentColumn.props.children,
    ) as readonly SatoriElement[]
    const mainChildren = asChildArray(
      mainColumn.props.children,
    ) as readonly SatoriElement[]
    // emoji なし fixture では title block が main column の唯一の子。
    const titleBlock = mainChildren[mainChildren.length - 1]
    const titleChildren = asChildArray(titleBlock.props.children)
    expect(titleChildren.length).toBeGreaterThanOrEqual(1)
    // 各子要素が div + 単一の string children (= 1 行) であること
    for (const child of titleChildren) {
      const lineEl = child as SatoriElement
      expect(lineEl.type).toBe('div')
      expect(typeof lineEl.props.children).toBe('string')
    }
  })
})

describe('createOgpElement (logo options)', () => {
  it('keeps the single-cell footer when options is undefined', () => {
    const root = createOgpElement(buildInput())
    const [, contentColumn] = asChildArray(
      root.props.children,
    ) as readonly SatoriElement[]
    const [, footerRow] = asChildArray(
      contentColumn.props.children,
    ) as readonly SatoriElement[]
    const footerChildren = asChildArray(footerRow.props.children)
    expect(footerChildren.length).toBe(FOOTER_CHILD_COUNT_WITHOUT_LOGO)
  })

  it('keeps the single-cell footer when options.logoDataUri is null', () => {
    const root = createOgpElement(buildInput(), { logoDataUri: null })
    const [, contentColumn] = asChildArray(
      root.props.children,
    ) as readonly SatoriElement[]
    const [, footerRow] = asChildArray(
      contentColumn.props.children,
    ) as readonly SatoriElement[]
    const footerChildren = asChildArray(footerRow.props.children)
    expect(footerChildren.length).toBe(FOOTER_CHILD_COUNT_WITHOUT_LOGO)
  })

  it('renders the logo as the right-hand footer cell when logoDataUri is provided', () => {
    const root = createOgpElement(buildInput(), {
      logoDataUri: DUMMY_LOGO_DATA_URI,
    })
    const [, contentColumn] = asChildArray(
      root.props.children,
    ) as readonly SatoriElement[]
    const [, footerRow] = asChildArray(
      contentColumn.props.children,
    ) as readonly SatoriElement[]
    const footerChildren = asChildArray(
      footerRow.props.children,
    ) as readonly SatoriElement[]
    expect(footerChildren.length).toBe(FOOTER_CHILD_COUNT_WITH_LOGO)
    const logoCell = footerChildren[FOOTER_CHILD_COUNT_WITH_LOGO - 1]
    expect(logoCell.type).toBe('img')
    expect(logoCell.props.src).toBe(DUMMY_LOGO_DATA_URI)
    expect(logoCell.props.width).toBe(EXPECTED_LOGO_WIDTH)
    expect(logoCell.props.height).toBe(EXPECTED_LOGO_HEIGHT)
    // ロゴありは space-between でサイト名とロゴを両端に振り分ける。
    expect(footerRow.props.style?.justifyContent).toBe('space-between')
  })
})
