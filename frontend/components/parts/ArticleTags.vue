<template>
  <ul v-if="topics.length > 0" class="v-ArticleTags">
    <!--
      TODO(phase-2): 将来的には /articles/tags/[tag] への NuxtLink として
      描画する。Phase 1 MVP ではタグ別ページが未実装なので、単なる
      バッジ表示 (非クリック) に留める。
    -->
    <li v-for="topic in topics" :key="topic" class="tag">
      {{ topic }}
    </li>
  </ul>
</template>

<script setup lang="ts">
/**
 * 記事の topics を横並びのバッジとして表示する presentational コンポーネント。
 *
 * Phase 1 ではクリックできないただの表示だが、`ArticleCard` / `ArticleHeader`
 * 等から切り出すことで、タグ別ページ実装時に 1 箇所だけ差し替えれば
 * 済むようにしておく (OCP)。
 */
withDefaults(
  defineProps<{
    topics?: string[]
  }>(),
  {
    topics: () => [],
  },
)
</script>

<style scoped lang="scss">
@use "assets/scss/color";

.v-ArticleTags {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  padding: 0.15rem 0.55rem;
  font-size: 0.8rem;
  color: color.$lnk-black;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 0.25rem;
}
</style>
