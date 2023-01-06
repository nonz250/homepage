<template>
  <div class="v-Work">
    <p class="vertical-inline">
      <anchor :link="link" class="mr-1">
        {{ name }}
      </anchor>
      <span v-if="attention.length" class="attention vertical-inline">
        <span class="material-icons-outlined">flag</span>
        <span>{{ attention }}</span>
      </span>
    </p>
    <anchor :link="link">
      <img :src="imagePath" alt="" class="image">
    </anchor>
  </div>
</template>

<script setup lang="ts">
import Anchor from '~/components/atoms/Anchor'
withDefaults(defineProps<{
  imagePath: string,
  link: string,
  name: string,
  attention?: string
}>(), {
  attention: ''
})
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

.attention {
  display: flex;
  align-items: flex-end;
  font-size: .8rem;
  color: $red;
}
</style>
