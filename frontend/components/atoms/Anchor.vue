<template>
  <a
    :href="link"
    target="_blank"
    rel="noopener noreferrer"
    class="v-Anchor"
    :class="{ shine: isActive }"
    @mouseover="active = true"
  >
    <slot />
  </a>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  link: string,
  shine?: boolean
}>(), {
  shine: true
})

const active = ref<boolean>(false)

const isActive = computed((): boolean => {
  return !props.shine ? false : active.value
})

watch(active, (value) => {
  if (value) {
    setTimeout(() => {
      active.value = false
    }, 500)
  }
})

onMounted(() => {
  setInterval(() => {
    active.value = true
  }, 3000)
})
</script>

<style scoped lang="scss">
@use "assets/scss/color";

.v-Anchor {
  position: relative;
  color: color.$lnk-black;
  font-weight: bold;
}

.shine {
  position: relative;
  overflow: hidden;
}

.shine::before {
  animation: shine 0.7s;
  content: '';
  position: absolute;
  top: 0;
  left: -25%;
  width: 50%;
  height: 100%;
  background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, .2) 100%);
  transform: skewX(-25deg);
}

@keyframes shine {
  100% {
    left: 50%;
  }
}
</style>
