/**
 * `utils/ogp/ogpTemplate.ts` の構造的 assert テスト。
 *
 * Satori の element ツリーは React.createElement 相当のプレーン
 * オブジェクトなので、PNG バイナリ snapshot を比較せず、構造
 * (children の数、accent bar の色、footer 子要素数 など) を直接
 * 検証する。フォント描画揺れに左右されない安定したテストにできる。
 *
 * 設計 v2 Step 0 を参照。logo オプション (Step 18-19) と
 * テーマカラー値 (Step 22) は別ステップで該当箇所のテストを
 * 追加・更新する。
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

/** root の直下は accent bar + content column の 2 要素 */
const ROOT_CHILD_COUNT = 2

/** content column の直下は main column + footer row の 2 要素 */
const CONTENT_COLUMN_CHILD_COUNT = 2

/** logo なしの footer は「サイト名 / 日付」の 2 要素 */
const FOOTER_CHILD_COUNT_WITHOUT_LOGO = 2

function buildInput(overrides: Partial<SafeOgpInput> = {}): SafeOgpInput {
  return {
    title: toSafeText('テストタイトル', 120),
    date: toSafeText('2026-04-28', 32),
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
    expect(typeof accentBar.props.style?.background).toBe('string')
    expect(accentBar.props.style?.background as string).toMatch(/^#[0-9a-fA-F]{6}$/)
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

  it('footer has exactly two cells (site name + date) when logo is absent', () => {
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
})
