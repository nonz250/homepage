<template>
  <img class="v-MiniImage" :src="src" alt="">
</template>

<script setup lang="ts">
defineProps<{
  src: string
}>()
</script>

<style scoped lang="scss">
.v-MiniImage {
  width: 100px;
  height: 100px;
  border-radius: 50%;
}
</style>
