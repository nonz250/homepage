<template>
  <header class="v-ArticleHeader">
    <div class="title-row">
      <h1 class="title">
        <span v-if="article.emoji" class="emoji" aria-hidden="true">{{ article.emoji }}</span>
        <span>{{ article.title }}</span>
      </h1>
      <span v-if="isDraft" class="draft-badge">Draft</span>
    </div>
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
  </header>
</template>

<script setup lang="ts">
/**
 * 記事詳細ページ上部に配置するヘッダ。
 *
 * タイトル / 公開日 / topics / Draft バッジのみを表示する presentational
 * コンポーネント。判定ロジックは持たず、`isDraft` は親 (詳細ページ) から
 * preview 状態と `published` フラグで導出して渡す。
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

.v-ArticleHeader {
  padding: 1.5rem 0 1rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: bold;
  line-height: 1.4;
  color: color.$black;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  overflow-wrap: anywhere;

  @media screen and (max-width: 600px) {
    font-size: 1.4rem;
  }
}

.emoji {
  font-size: 1.9rem;
  line-height: 1;

  @media screen and (max-width: 600px) {
    font-size: 1.5rem;
  }
}

.draft-badge {
  flex-shrink: 0;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
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
  font-size: 0.9rem;
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
  padding: 0.15rem 0.55rem;
  font-size: 0.8rem;
  color: color.$lnk-black;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 0.25rem;
}
</style>
