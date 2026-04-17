<script setup lang="ts">
/**
 * 記事個別ページの最小スケルトン。
 *
 * Phase 1 の Step 9 時点で prerender routes が指す `/articles/<slug>` の
 * HTML を生成できるようにするためだけのプレースホルダー実装。
 * UI 本実装は Step 10〜13 (次バッチ) で行う。
 *
 * MVVM の観点から、ここではビジネスロジック (公開可視性の判定など) を
 * 持たず、composable `useArticle` に委譲する。下書き (published: false) や
 * 未来 published_at の記事は本番では null となるため、404 扱いにする。
 */
import { useArticle } from '~/composables/useArticle'

const route = useRoute()
// `[...slug]` は配列で渡る可能性があるため文字列に正規化。
const slugParam = route.params.slug
const slug = Array.isArray(slugParam) ? slugParam.join('/') : String(slugParam)

const article = await useArticle(slug)

if (article === null) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Article not found',
    fatal: true,
  })
}
</script>

<template>
  <article v-if="article">
    <header>
      <h1>{{ article.title }}</h1>
      <p v-if="article.published_at">
        <time :datetime="article.published_at">{{ article.published_at }}</time>
      </p>
    </header>
    <!--
      Step 10〜13 で `ContentRenderer` / `MDC` コンポーネント経由で
      body を描画する。本 Step では slug の疎通確認のみ。
    -->
    <p>Slug: {{ article.slug }}</p>
  </article>
</template>
