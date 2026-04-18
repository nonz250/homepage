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
import { resolveArticleOgImagePath } from '~/constants/seo'

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
const canonicalUrl: string = `${baseUrl}/articles/${slug}/`
const ogImageUrl: string = `${baseUrl}${resolveArticleOgImagePath(slug)}`

useHead({
  title: `${article.title} - Nozomi Hosaka`,
})
useSeoMeta({
  description,
  ogType: 'article',
  ogTitle: article.title,
  ogDescription: description,
  ogUrl: canonicalUrl,
  ogImage: ogImageUrl,
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

  :deep(h2) {
    margin-top: 2rem;
    padding-bottom: 0.3rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 1.4rem;
  }

  :deep(h3) {
    margin-top: 1.5rem;
    font-size: 1.15rem;
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
}
</style>
