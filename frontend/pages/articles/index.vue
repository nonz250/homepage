<script setup lang="ts">
/**
 * 記事一覧ページ `/articles`。
 *
 * `useArticles` で可視性フィルタ済みの記事配列を取得し、`ArticleCard`
 * を繰り返し描画するだけの薄いページ。下書きフラグは preview 状態に
 * 応じて 1 箇所で導出し、各カードに props として流す。
 *
 * prerender 対象として `nuxt.config.ts` の `nitro.prerender.routes` に
 * `/articles` を含める。個別 `/articles/:slug` は nitro:config フックで
 * 追加済み。
 *
 * 既存ページ (pages/index.vue) と同じく、components は parts/atoms の
 * prefix 付き auto-import ではなく、明示的 import で利用する方針に揃える。
 */
import ArticleCard from '~/components/parts/ArticleCard.vue'
import { useArticles } from '~/composables/useArticles'
import { useContentPreview } from '~/composables/useContentPreview'
import { ARTICLES_LIST_LIMIT } from '~/constants/article'

const preview = useContentPreview()
const articles = await useArticles({ preview, limit: ARTICLES_LIST_LIMIT })

useHead({
  title: 'Articles - Nozomi Hosaka',
  meta: [
    {
      name: 'description',
      content: 'Nozomi Hosaka のブログ記事一覧です。',
    },
  ],
})
</script>

<template>
  <main class="articles-list content">
    <h1 class="page-title">
      Articles
    </h1>
    <ul v-if="articles.length > 0" class="article-grid">
      <li v-for="article in articles" :key="article.slug">
        <article-card :article="article" :is-draft="preview && !article.published" />
      </li>
    </ul>
    <p v-else class="empty">
      まだ記事がありません。
    </p>
  </main>
</template>

<style scoped lang="scss">
@use "assets/scss/color";
@use "assets/scss/size";

.articles-list {
  padding-bottom: 3rem;
}

.page-title {
  margin: 0 0 1.5rem 0;
  padding: 0;
  font-size: 2rem;
  font-weight: normal;

  @media screen and (max-width: 600px) {
    font-size: 1.6rem;
  }
}

.article-grid {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(size.$item-size, 1fr));
}

.empty {
  color: color.$lnk-black;
}
</style>
