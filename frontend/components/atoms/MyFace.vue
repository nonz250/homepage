<template>
  <div class="v-MyFace">
    <img class="image" src="images/face.jpg" alt="">
  </div>
</template>

<script>
export default {
  name: 'MyFace'
}
</script>

<style scoped lang="scss">
.v-MyFace {
  position: relative;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  overflow: hidden;
}

.image {
  position: absolute;
  width: 100%;
}
</style>
