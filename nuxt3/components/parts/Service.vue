<template>
  <div class="v-Service">
    <p class="tmp-link">
      {{ title }}
    </p>
    <div class="icon">
      <span class="material-icons large">
        {{ icon }}
      </span>
    </div>
    <div class="description">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string,
  icon: string
}>()
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.v-Service {
  width: $item-size;
}

.icon {
  display: grid;
  justify-items: center;
  align-items: center;

  > .large {
    font-size: 5rem;
  }
}

.description {
  font-size: .9rem;
}

.tmp-link {
  color: $lnk-black;
  font-weight: bold;
  text-align: center;
}

</style>
