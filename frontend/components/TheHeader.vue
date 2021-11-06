<template>
  <header class="v-Header">
    <div class="actions parallax-bg" :class="{ hide: !hideScrollingActions }">
      <div class="left" />
      <div class="center">
        <a href="#about" class="actions-link mr-1">
          About
        </a>
        <a href="#service" class="actions-link mr-1">
          Service
        </a>
        <a href="#works" class="actions-link mr-1">
          Works
        </a>
        <anchor link="https://labo.nozomi.bike" :shine="false" class="actions-link">
          Blog
        </anchor>
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

<script>
import Anchor from '~/components/atoms/Anchor'
import scrollMixin from '~/mixins/scrollMixin'

export default {
  name: 'TheHeader',
  components: { Anchor },
  mixins: [scrollMixin],
  data () {
    return {
      hideScrollingActions: true
    }
  },
  mounted () {
    setInterval(() => {
      this.setHideScrollingActions()
    }, 1000 / this.FPS60)
  },
  methods: {
    setHideScrollingActions () {
      this.hideScrollingActions = this.currentScrollY <= this.SCROLL_TOP_POSITION
    }
  }
}
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.v-Header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
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
  z-index: 1000;
}

.content {
  position: absolute;
  top: .5rem;
  right: 0;
  z-index: 1100;
}
</style>
