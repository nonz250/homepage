<script setup lang="ts">
/**
 * 記事個別ページ。
 *
 * 公開判定は `useArticle` に委譲し、下書き / 予約投稿は preview でない
 * 限り null を返すので 404 扱いにする。本文および TOC は `queryCollection`
 * から直接取得して `ContentRenderer` へ渡す。
 *
 * MVVM の観点では、本ページは「取得 + 404 判定 + head 設定 + 描画の束ね」の
 * みを持ち、個別の描画責務は ArticleHeader / ArticleToc / ContentRenderer に
 * 完全に委譲している。
 */
import { queryCollection } from '#imports'
import ArticleHeader from '~/components/parts/ArticleHeader.vue'
import ArticleToc from '~/components/parts/ArticleToc.vue'
import { useArticle } from '~/composables/useArticle'
import { useContentPreview } from '~/composables/useContentPreview'
import {
  flattenTocLinks,
  type FlatTocHeading,
  type TocLink,
} from '~/utils/article/flattenTocLinks'
import {
  OGP_IMAGE_MIME_TYPE,
  resolveArticleOgImagePath,
} from '~/constants/seo'
import { OGP_IMAGE_HEIGHT, OGP_IMAGE_WIDTH } from '~/constants/ogp'
import { buildAbsoluteUrl } from '~/utils/seo/buildAbsoluteUrl'

const route = useRoute()
// `[...slug]` は配列で渡る可能性があるため文字列に正規化。
const slugParam = route.params.slug
const slug = Array.isArray(slugParam) ? slugParam.join('/') : String(slugParam)

const preview = useContentPreview()
const article = await useArticle(slug, { preview })

if (article === null) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Article not found',
    fatal: true,
  })
}

// 本文 (body) と TOC は queryCollection から直接取得する。
// 公開判定は useArticle 側で済んでいるため、ここでは preview 非対応の
// ルート上にも未公開記事が来ないことを前提にしてよい。
// 型安全性より Phase 1 の YAGNI を優先し、必要最小限のプロパティだけ
// 型注釈で拾う形とする。
type ArticleContent = {
  body?: unknown
  toc?: { links?: TocLink[] }
  description?: string
} & Record<string, unknown>

const articleContent = (await queryCollection('articles')
  .path(`/${slug}`)
  .first()) as ArticleContent | null

if (articleContent === null) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Article not found',
    fatal: true,
  })
}

const tocHeadings: FlatTocHeading[] = flattenTocLinks(
  articleContent.toc?.links,
)
const isDraft = preview && !article.published
const description: string =
  typeof articleContent.description === 'string' && articleContent.description
    ? articleContent.description
    : `${article.title} | Nozomi Hosaka`

// 記事個別の Open Graph / SEO メタを組み立てる。
// baseUrl は runtimeConfig.public に置かれており、クライアント側からも
// 参照できる (prerender 時にも展開済み)。記事 URL は `/articles/<slug>` に
// そろえる。
// OG 画像は Phase 4 Batch B から記事単位で切り替える。
// `nitro:build:public-assets` hook で `.output/public/ogp/<slug>.png` を
// 生成し、ここから `/ogp/<slug>.png` として参照する。slug が予想外の値でも
// fallback に倒すガードが `resolveArticleOgImagePath` 内に入っている。
const runtimeConfig = useRuntimeConfig()
const baseUrl: string = runtimeConfig.public.baseUrl
// 末尾スラッシュ付きに揃える。nginx 側で `/articles/<slug>` → `/articles/<slug>/`
// に 301 リダイレクトされるため、og:url が redirect 元のままだと SNS クローラが
// canonical 不一致でカード表示を失敗することがある。redirect 後の URL に寄せる。
const canonicalUrl: string = buildAbsoluteUrl(baseUrl, `/articles/${slug}/`)
const ogImageUrl: string = buildAbsoluteUrl(
  baseUrl,
  resolveArticleOgImagePath(slug),
)
const ogImageAlt: string = `${article.title} - Nozomi Hosaka`

useHead({
  title: `${article.title} - Nozomi Hosaka`,
})
// Slack / Twitter X / Facebook の OGP unfurl には絶対 URL + 寸法 + MIME +
// alt + Twitter Card 系列を全て揃える必要がある。動的値 (article.title) は
// 型付き API (useSeoMeta) で扱い、誤った tag 名が使われないように維持する。
useSeoMeta({
  description,
  ogType: 'article',
  ogTitle: article.title,
  ogDescription: description,
  ogUrl: canonicalUrl,
  ogImage: ogImageUrl,
  ogImageType: OGP_IMAGE_MIME_TYPE,
  ogImageWidth: OGP_IMAGE_WIDTH,
  ogImageHeight: OGP_IMAGE_HEIGHT,
  ogImageAlt: ogImageAlt,
  twitterCard: 'summary_large_image',
  twitterTitle: article.title,
  twitterDescription: description,
  twitterImage: ogImageUrl,
  twitterImageAlt: ogImageAlt,
})
</script>

<template>
  <main class="article-detail content">
    <article v-if="article" class="article">
      <article-header :article="article" :is-draft="isDraft" />
      <article-toc v-if="tocHeadings.length > 0" :headings="tocHeadings" class="toc" />
      <div class="body">
        <ContentRenderer :value="articleContent" />
      </div>
    </article>
  </main>
</template>

<style scoped lang="scss">
@use "assets/scss/color";
@use "assets/scss/typography";

.article-detail {
  padding-bottom: 3rem;
}

.article {
  max-width: 800px;
  margin: 0 auto;
}

.toc {
  margin: 1.5rem 0;
}

.body {
  margin-top: 1.5rem;
  line-height: 1.8;
  color: color.$black;

  // Markdown ヘディング (h2〜h6) の共通設定。
  // ID アンカーで遷移した際、固定ヘッダの下に隠れないよう scroll-margin-top を確保する。
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin-bottom: typography.$article-heading-margin-bottom;
    line-height: typography.$article-heading-line-height;
    font-weight: bold;
    color: color.$black;
    scroll-margin-top: var(--header-height);
  }

  :deep(h2) {
    margin-top: typography.$article-heading-margin-top-h2;
    padding-bottom: typography.$article-heading-h2-padding-bottom;
    border-bottom: 1px solid typography.$article-heading-h2-border-color;
    font-size: typography.$article-heading-font-size-h2;
  }

  :deep(h3) {
    margin-top: typography.$article-heading-margin-top-h3;
    font-size: typography.$article-heading-font-size-h3;
  }

  :deep(h4) {
    margin-top: typography.$article-heading-margin-top-h4;
    font-size: typography.$article-heading-font-size-h4;
  }

  :deep(h5) {
    margin-top: typography.$article-heading-margin-top-h5;
    font-size: typography.$article-heading-font-size-h5;
    color: color.$lnk-black;
  }

  :deep(h6) {
    margin-top: typography.$article-heading-margin-top-h6;
    font-size: typography.$article-heading-font-size-h6;
    color: color.$lnk-black;
  }

  // モバイル幅では各ヘディングをやや縮小し、画面占有を抑えつつ階層感は保つ。
  @media screen and (max-width: 600px) {
    :deep(h2) {
      font-size: typography.$article-heading-font-size-mobile-h2;
    }

    :deep(h3) {
      font-size: typography.$article-heading-font-size-mobile-h3;
    }

    :deep(h4) {
      font-size: typography.$article-heading-font-size-mobile-h4;
    }

    :deep(h5) {
      font-size: typography.$article-heading-font-size-mobile-h5;
    }

    :deep(h6) {
      font-size: typography.$article-heading-font-size-mobile-h6;
    }
  }

  :deep(p) {
    margin: 1rem 0;
  }

  :deep(ul),
  :deep(ol) {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  :deep(pre) {
    padding: 1rem;
    overflow-x: auto;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 0.25rem;
    font-size: 0.9rem;
  }

  :deep(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
  }

  // GFM テーブル (`| col | col |`) の見た目。Markdown パイプラインは
  // 変更せず、記事本文内で出力される素の `<table>` に対してスタイルを
  // 当てるだけに留めている。本文幅を超える場合は横スクロールする。
  :deep(table) {
    display: block;
    width: max-content;
    max-width: 100%;
    margin: 1.5rem 0;
    overflow-x: auto;
    border-collapse: collapse;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  :deep(thead) {
    background-color: rgba(0, 0, 0, 0.04);
  }

  :deep(tbody tr:nth-child(even)) {
    background-color: rgba(0, 0, 0, 0.02);
  }

  :deep(th),
  :deep(td) {
    padding: 0.5rem 0.75rem;
    border: 1px solid rgba(0, 0, 0, 0.12);
    vertical-align: top;
    text-align: left;
  }

  :deep(th) {
    font-weight: 600;
  }
}
</style>
