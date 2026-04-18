/**
 * 記事メタから Satori OGP の入力 (`SafeOgpInput`) 配列を構築する純関数。
 *
 * ビルド時 hook (`nitro:build:public-assets`) から呼ぶことで、公開対象の
 * 記事のみを OGP 生成対象として取り出せる。公開判定は `buildPrerenderRoutes`
 * と同じロジックを使うと二重管理になるため、ここは buildPrerenderRoutes が
 * 既に生成した route 一覧から逆引きする設計も考えられるが、可読性のため
 * articles から直接フィルタする (同じ述語を内部で再利用する)。
 *
 * fail-closed: production build で preview が true の場合は throw する。
 * これは `buildPrerenderRoutes` と同じ方針 (PREVIEW_IN_PRODUCTION_ERROR_MESSAGE
 * を持ち出さず、独立にチェックしてもよいが、同じ純関数に依存させる)。
 */
import type { LoadedArticle } from '../prerender/loadArticlesFromFs'
import { buildPrerenderRoutes } from '../prerender/buildPrerenderRoutes'
import {
  toSafeText,
  type SafeOgpInput,
  type SafeText,
} from '../../types/ogp-input'

/** タイトルの最大長 (OGP_TITLE_MAX_LENGTH と揃える余地もあるが、描画崩れ抑止のため短め) */
const OGP_INPUT_TITLE_MAX = 120

/** 日付文字列の最大長 (YYYY-MM-DD + 余白) */
const OGP_INPUT_DATE_MAX = 32

/** 1 個の tag 最大長 */
const OGP_INPUT_TAG_MAX = 32

/** tags 配列の最大件数 */
const OGP_INPUT_TAGS_MAX_COUNT = 5

/** 絵文字想定の最大長 (サロゲートペア 1 字 = 2, 組み合わせ絵文字対応で少し余裕) */
const OGP_INPUT_EMOJI_MAX = 8

/**
 * `buildOgpInputs` の戻り 1 要素。slug と入力データのペア。
 */
export interface OgpInputEntry {
  readonly slug: string
  readonly input: SafeOgpInput
}

/**
 * `buildOgpInputs` のオプション。
 */
export interface BuildOgpInputsOpts {
  readonly preview: boolean
  readonly nodeEnv: string | undefined
  readonly buildTime: Date
}

/**
 * 拡張記事メタ。loadArticlesFromFs の戻り型を base に、OGP 用の emoji を
 * optional に受け取る。emoji は frontmatter から渡す想定。
 */
export interface OgpSourceArticle extends LoadedArticle {
  readonly emoji?: string
}

/**
 * 公開対象の記事を OGP 生成用の入力に変換する。
 *
 * 公開判定は `buildPrerenderRoutes` と同じ (production で preview=true なら
 * throw)。
 */
export function buildOgpInputs(
  articles: readonly OgpSourceArticle[],
  opts: BuildOgpInputsOpts,
): OgpInputEntry[] {
  // production-preview 禁止の例外はここで投げる (buildPrerenderRoutes に合わせる)
  const routes = buildPrerenderRoutes(articles, opts.buildTime, {
    preview: opts.preview,
    nodeEnv: opts.nodeEnv,
  })
  const visibleSlugs = new Set(
    routes.map((r) => r.replace(/^\/articles\//, '')),
  )
  return articles
    .filter((a) => visibleSlugs.has(a.slug))
    .map((a) => ({
      slug: a.slug,
      input: articleToSafeInput(a),
    }))
}

/**
 * 記事 1 件を `SafeOgpInput` に変換する純関数 (内部ヘルパ)。
 */
function articleToSafeInput(article: OgpSourceArticle): SafeOgpInput {
  const tags: SafeText[] = []
  for (const topic of article.topics.slice(0, OGP_INPUT_TAGS_MAX_COUNT)) {
    const safe = toSafeText(topic, OGP_INPUT_TAG_MAX)
    if (safe.length > 0) tags.push(safe)
  }
  const title: SafeText = toSafeText(
    article.title || article.slug,
    OGP_INPUT_TITLE_MAX,
  )
  const date: SafeText = toSafeText(
    formatDate(article.published_at),
    OGP_INPUT_DATE_MAX,
  )
  const emoji: SafeText | undefined =
    typeof article.emoji === 'string' && article.emoji.length > 0
      ? toSafeText(article.emoji, OGP_INPUT_EMOJI_MAX)
      : undefined
  return {
    title,
    date,
    tags,
    emoji,
    theme: 'light',
  }
}

/**
 * published_at (ISO 文字列) を YYYY-MM-DD に整形する。
 * 不正値や未指定は空文字。
 */
function formatDate(raw: string | undefined): string {
  if (!raw) return ''
  const ms = Date.parse(raw)
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0')
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const dd = d.getUTCDate().toString().padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
