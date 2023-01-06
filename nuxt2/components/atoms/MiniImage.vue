<template>
  <img class="v-MiniImage" :src="src" alt="">
</template>

<script>
export default {
  name: 'MiniImage',
  props: {
    src: {
      type: String,
      required: true
    }
  }
}
</script>

<style scoped lang="scss">
.v-MiniImage {
  width: 100px;
  height: 100px;
  border-radius: 50%;
}
</style>
