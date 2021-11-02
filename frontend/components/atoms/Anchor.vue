<template>
  <a :href="link" target="_blank" rel="noopener noreferrer" class="v-Anchor">
    <slot />
  </a>
</template>

<script>
export default {
  name: 'Anchor',
  props: {
    link: {
      type: String,
      required: true
    }
  }
}
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.v-Anchor {
  color: $lab-blue;
}
</style>
