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
    },
    attention: {
      type: String,
      default: ''
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

.attention {
  display: flex;
  align-items: flex-end;
  font-size: .8rem;
  color: $red;
}
</style>
