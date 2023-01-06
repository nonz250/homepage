<template>
  <div class="v-MyFace">
    <img class="image" src="/images/face.webp" alt="">
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped lang="scss">
.v-MyFace {
  position: relative;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  overflow: hidden;
}

.image {
  position: absolute;
  width: 100%;
}
</style>
