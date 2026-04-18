<template>
  <details class="details">
    <summary class="summary">{{ title }}</summary>
    <div class="body">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
/**
 * Zenn 独自記法 `:::details タイトル` に対応する MDC コンポーネント。
 *
 * `<details>` / `<summary>` のネイティブ HTML 要素を用いて折りたたみ UI を
 * 提供する。折りたたみ状態はブラウザ側で管理するため、Vue レベルでは
 * 状態を持たずステートレスに保つ (SRP)。本文となる slot 内容は `<summary>`
 * の外側・`<details>` の直下に配置し、開いたときだけ表示される。
 *
 * i18n や icon 差し替えは本 Phase のスコープ外。SCSS で開閉マーカー
 * (disclosure triangle) の外観を軽く整えるのみに留める。
 */
defineProps<{
  title: string
}>()
</script>

<style scoped lang="scss">
@use "assets/scss/color";

.details {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 0.4rem;
  background-color: color.$white;
}

.summary {
  cursor: pointer;
  font-weight: 600;
  color: color.$black;
  outline: none;
  list-style: revert;

  &:hover {
    color: color.$lab-blue;
  }

  &:focus-visible {
    outline: 2px solid color.$lab-blue;
    outline-offset: 2px;
    border-radius: 0.2rem;
  }
}

.body {
  margin-top: 0.75rem;
  line-height: 1.6;
  color: color.$black;

  :deep(p:first-child) {
    margin-top: 0;
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }
}
</style>
