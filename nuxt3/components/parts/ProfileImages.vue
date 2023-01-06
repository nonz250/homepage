<template>
  <div class="v-ProfileImages" @click="click">
    <my-face />
    <mini-image src="/images/valcans.webp" class="bubble-image" :class="z250Class" />
    <mini-image src="/images/small_me.webp" class="bubble-image" :class="smallMeClass" />
  </div>
</template>

<script setup lang="ts">
import MyFace from '~/components/atoms/MyFace'
import MiniImage from '~/components/atoms/MiniImage'

const moving = ref<boolean>(false)
const z250 = ref<{
  top: boolean,
  left: boolean
}>({
  top: true,
  left: true
})
const smallMe = ref<{
  top: boolean,
  left: boolean
}>({
  top: false,
  left: false
})

const z250Class = computed(() => {
  return {
    top: z250.value.top,
    right: !z250.value.left,
    bottom: !z250.value.top,
    left: z250.value.left
  }
})

const smallMeClass = computed(() => {
  return {
    top: smallMe.value.top,
    right: !smallMe.value.left,
    bottom: !smallMe.value.top,
    left: smallMe.value.left
  }
})

const click = () => {
  if (moving.value) {
    return
  }
  moving.value = true
  z250.value.left = !z250.value.left
  smallMe.value.left = !smallMe.value.left
  setTimeout(() => {
    z250.value.top = !z250.value.top
    smallMe.value.top = !smallMe.value.top
    moving.value = false
  }, 250)
}
</script>

<style scoped lang="scss">
.v-ProfileImages {
  position: relative;
  cursor: pointer;
}

.bubble-image {
  position: absolute;
  transition:all .25s linear;
}

.top {
  top: 0;
}

.right {
  left: 200px;
}

.bottom {
  top: 200px;
}

.left {
  left: 0;
}

</style>
