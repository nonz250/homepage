<template>
  <div class="v-ProfileImages" @click="click">
    <my-face />
    <mini-image src="images/z250.jpg" class="bubble-image" :class="z250Class" />
    <mini-image src="images/small_me.jpg" class="bubble-image" :class="smallMeClass" />
  </div>
</template>

<script>
import MyFace from '~/components/atoms/MyFace'
import MiniImage from '~/components/atoms/MiniImage'

export default {
  name: 'ProfileImages',
  components: { MiniImage, MyFace },
  data () {
    return {
      moving: false,
      z250: {
        top: true,
        left: true
      },
      smallMe: {
        top: false,
        left: false
      }
    }
  },
  computed: {
    z250Class () {
      return {
        top: this.z250.top,
        right: !this.z250.left,
        bottom: !this.z250.top,
        left: this.z250.left
      }
    },
    smallMeClass () {
      return {
        top: this.smallMe.top,
        right: !this.smallMe.left,
        bottom: !this.smallMe.top,
        left: this.smallMe.left
      }
    }
  },
  methods: {
    click () {
      if (this.moving) {
        return
      }
      this.moving = true
      this.z250.left = !this.z250.left
      this.smallMe.left = !this.smallMe.left
      setTimeout(() => {
        this.z250.top = !this.z250.top
        this.smallMe.top = !this.smallMe.top
        this.moving = false
      }, 250)
    }
  }
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
  z-index: 200;
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
