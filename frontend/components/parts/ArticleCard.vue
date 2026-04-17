<template>
  <nuxt-link :to="`/articles/${article.slug}`" class="v-ArticleCard">
    <article class="card">
      <header class="card-header">
        <h3 class="title">
          <span v-if="article.emoji" class="emoji" aria-hidden="true">{{ article.emoji }}</span>
          <span>{{ article.title }}</span>
        </h3>
        <span v-if="isDraft" class="draft-badge">Draft</span>
      </header>
      <div class="meta">
        <time v-if="publishedDate" :datetime="article.published_at" class="published-at">
          {{ publishedDate }}
        </time>
        <ul v-if="article.topics.length > 0" class="topics">
          <li v-for="topic in article.topics" :key="topic" class="topic">
            {{ topic }}
          </li>
        </ul>
      </div>
    </article>
  </nuxt-link>
</template>

<script setup lang="ts">
/**
 * 記事カード (一覧表示用) の presentational コンポーネント。
 *
 * props だけで表示が決まり、取得や公開判定などのロジックは一切持たない。
 * `isDraft` は親 (一覧ページや index.vue) が preview 状態と `published`
 * フラグから導出して渡す。
 */
import { computed } from 'vue'
import type { Article } from '~/utils/article/articleVisibility'
import { formatPublishedDate } from '~/utils/article/formatArticleDate'

const props = withDefaults(
  defineProps<{
    article: Article
    isDraft?: boolean
  }>(),
  {
    isDraft: false,
  },
)

const publishedDate = computed<string>(() =>
  formatPublishedDate(props.article.published_at),
)
</script>

<style scoped lang="scss">
@use "assets/scss/color";
@use "assets/scss/size";

.v-ArticleCard {
  display: block;
  color: color.$black;
  text-decoration: none;
}

.card {
  width: 100%;
  padding: 1.25rem 1.5rem;
  background-color: color.$white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 0.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: bold;
  line-height: 1.5;
  color: color.$black;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.emoji {
  font-size: 1.3rem;
  line-height: 1;
}

.draft-badge {
  flex-shrink: 0;
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  font-weight: bold;
  color: color.$white;
  background-color: color.$red;
  border-radius: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.meta {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.published-at {
  font-size: 0.85rem;
  color: color.$lnk-black;
}

.topics {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.topic {
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  color: color.$lnk-black;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 0.25rem;
}
</style>
