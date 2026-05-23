<template>
  <header class="v-Header">
    <div class="actions parallax-bg" :class="{ hide: !hideScrollingActions }">
      <div class="left" />
      <div class="center">
        <nuxt-link to="/#about" class="actions-link">
          About
        </nuxt-link>
        <nuxt-link to="/#service" class="actions-link">
          Service
        </nuxt-link>
        <nuxt-link to="/#works" class="actions-link">
          Works
        </nuxt-link>
        <nuxt-link to="/articles" class="actions-link">
          Articles
        </nuxt-link>
        <nuxt-link to="/#contact" class="actions-link">
          Contact
        </nuxt-link>
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
import { onBeforeUnmount, onMounted, ref } from "vue";
import Anchor from "~/components/atoms/Anchor.vue";
import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
import {
  HEADER_SCROLL_CHECK_FPS,
  HEADER_SHRINK_THRESHOLD_PX,
  MILLISECONDS_PER_SECOND,
} from "~/constants/timing";

const currentScrollY = ref<number>(0)

const setCurrentScrollPositionY = () => {
  currentScrollY.value = window.scrollY
}

const hideScrollingActions = ref<boolean>(true)

const setHideScrollingActions = () => {
  hideScrollingActions.value = currentScrollY.value <= HEADER_SHRINK_THRESHOLD_PX
}

let scrollCheckIntervalId: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  setCurrentScrollPositionY()
  document.addEventListener('scroll', setCurrentScrollPositionY)

  scrollCheckIntervalId = setInterval(() => {
    setHideScrollingActions()
  }, MILLISECONDS_PER_SECOND / HEADER_SCROLL_CHECK_FPS)
})

onBeforeUnmount(() => {
  document.removeEventListener('scroll', setCurrentScrollPositionY)
  if (scrollCheckIntervalId !== null) {
    clearInterval(scrollCheckIntervalId)
    scrollCheckIntervalId = null
  }
})
</script>

<style scoped lang="scss">
@use "assets/scss/color";
@use "assets/scss/size";

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
  padding: calc(50px - 17.5px) 1rem !important;
  box-sizing: border-box;

  @media screen and (max-width: size.$breakpoint-mobile) {
    padding: 0.5rem 0.75rem !important;
  }
}

.actions-link {
  color: color.$lnk-black;
  font-weight: bold;
  font-size: 1.5rem;
  text-decoration: none;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;

  @media screen and (max-width: size.$breakpoint-mobile) {
    font-size: 0.9rem;
    padding: 0.5rem 0.35rem;
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
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
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
      color: color.$black !important;
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
