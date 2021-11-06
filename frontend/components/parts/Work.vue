<template>
  <div class="v-Work">
    <anchor :link="link">
      <p>{{ name }}</p>
      <img :src="imagePath" alt="" class="image">
    </anchor>
  </div>
</template>

<script>
import Anchor from '~/components/atoms/Anchor'

export default {
  name: 'Work',
  components: { Anchor },
  props: {
    imagePath: {
      type: String,
      required: true
    },
    link: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  }
}
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.v-Work {
  width: $item-size;
  display: grid;
  align-items: center;
}

.image {
  width: 100%;
}
</style>
