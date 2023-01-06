<template>
  <header class="v-Header">
    <div class="actions parallax-bg" :class="{ hide: !hideScrollingActions }">
      <div class="left" />
      <div class="center">
<!--        <nuxt-link v-scroll-to="'#about'" class="actions-link mr-1" to>-->
<!--          About-->
<!--        </nuxt-link>-->
<!--        <nuxt-link v-scroll-to="'#service'" class="actions-link mr-1" to>-->
<!--          Service-->
<!--        </nuxt-link>-->
<!--        <nuxt-link v-scroll-to="'#works'" class="actions-link mr-1" to>-->
<!--          Works-->
<!--        </nuxt-link>-->
<!--        <nuxt-link v-scroll-to="'#contact'" class="actions-link mr-1" to>-->
<!--          Contact-->
<!--        </nuxt-link>-->
<!--        <anchor link="https://labo.nozomi.bike" :shine="false" class="actions-link">-->
<!--          Blog-->
<!--        </anchor>-->
      </div>
      <div class="right" />
    </div>

    <div class="scrolling-actions" :class="{ hide: hideScrollingActions }">
      <div class="left" />
      <div class="center" />
      <div class="right">
        <div class="triangle-wrap">
          <div class="triangle" />
          <div class="content">
            <anchor link="https://github.com/nonz250" :shine="false">
              <font-awesome-icon :icon="['fab', 'github']" class="sns-icon github" />
            </anchor>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import Anchor from "~/components/atoms/Anchor.vue";

const FPS60 = ref<number>(60)
const SCROLL_TOP_POSITION = ref<number>(5)
const currentScrollY = ref<number>(0)

const setCurrentScrollPositionY = () => {
  currentScrollY.value = window.scrollY
}

const hideScrollingActions = ref<boolean>(true)

const setHideScrollingActions = () => {
  hideScrollingActions.value = currentScrollY.value <= SCROLL_TOP_POSITION.value
}

onMounted(() => {
  setCurrentScrollPositionY()
  setInterval(() => {
    setHideScrollingActions()
  }, 1000 / FPS60.value)
})
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.v-Header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10000;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-content: center;
  padding: calc(50px - 17.5px) 0 !important;
}

.actions-link {
  color: $lnk-black;
  font-weight: bold;
  font-size: 1.5rem;
  @media screen and (max-width: 600px) {
    font-size: 1rem;
  }
}

.scrolling-actions {
  display: flex;
  justify-content: space-between;
  align-content: center;
}

.hide {
  display: none;
}

.center {
  display: flex;
  justify-content: flex-end;
  align-content: center;
}

.right {
  display: flex;
  justify-content: flex-end;
  align-content: center;
}

.sns {
  &-icon {
    font-size: 2rem;
    margin-right: .5rem;

    &.github {
      color: $black !important;
    }
  }
}

.triangle-wrap {
  position: relative;
}

.triangle {
  position: absolute;
  top: 0;
  right: 0;
  border-top: 5rem solid #e5e5e5;
  border-left: 5rem solid transparent;
}

.content {
  position: absolute;
  top: .5rem;
  right: 0;
}
</style>
