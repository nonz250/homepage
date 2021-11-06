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

<script>
export default {
  name: 'Anchor',
  props: {
    link: {
      type: String,
      required: true
    },
    shine: {
      type: Boolean,
      default: true
    }
  },
  data () {
    return {
      active: false
    }
  },
  computed: {
    isActive () {
      if (!this.shine) {
        return false
      }
      return this.active
    }
  },
  watch: {
    active (value) {
      if (value) {
        setTimeout(() => {
          this.active = false
        }, 500)
      }
    }
  },
  mounted () {
    setInterval(() => {
      this.active = true
    }, 3000)
  }
}
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.v-Anchor {
  color: $lnk-black;
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
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, .3) 100%);
  transform: skewX(-25deg);
}

//.shine:hover::before {
//  display: block;
//  animation: shine 0.7s;
//}

@keyframes shine {
  100% {
    left: 125%;
  }
}
</style>
