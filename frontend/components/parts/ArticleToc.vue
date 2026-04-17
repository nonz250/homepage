<template>
  <nav v-if="headings.length > 0" aria-label="目次" class="v-ArticleToc">
    <p class="toc-title">目次</p>
    <ul class="toc-list">
      <li
        v-for="heading in headings"
        :key="heading.id"
        :class="`depth-${heading.depth}`"
        class="toc-item"
      >
        <a :href="`#${heading.id}`" class="toc-link">{{ heading.text }}</a>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
/**
 * 記事詳細ページ用の目次 (TOC) コンポーネント。
 *
 * Phase 1 では `@nuxtjs/mdc` が生成する `body.toc.links` を平坦化した
 * 配列を props として受け取る想定。ネスト表現はスタイル (インデント) で
 * 擬似的に表現する方針とし、Phase 2 で本格的なツリー描画を検討する。
 *
 * props 型を定義しておくことで、データソース側 (詳細ページ) から
 * どんな shape を渡せばよいかが明確になる。
 */

/** TOC の 1 項目 */
export interface TocHeading {
  readonly id: string
  readonly text: string
  /** h2〜h6 に対応する 2〜6 の整数 */
  readonly depth: number
}

withDefaults(
  defineProps<{
    headings?: TocHeading[]
  }>(),
  {
    headings: () => [],
  },
)
</script>

<style scoped lang="scss">
@use "assets/scss/color";

.v-ArticleToc {
  padding: 1rem 1.25rem;
  background-color: rgba(0, 0, 0, 0.03);
  border-left: 3px solid color.$lab-blue;
  border-radius: 0.25rem;
}

.toc-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  font-weight: bold;
  color: color.$black;
}

.toc-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc-item {
  margin: 0.2rem 0;

  // h2 はインデントなし、h3 以降は深さ分インデントする。
  &.depth-3 {
    padding-left: 1rem;
  }

  &.depth-4 {
    padding-left: 2rem;
  }

  &.depth-5 {
    padding-left: 3rem;
  }

  &.depth-6 {
    padding-left: 4rem;
  }
}

.toc-link {
  color: color.$lnk-black;
  font-size: 0.9rem;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
