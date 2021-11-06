<template>
  <footer class="v-Footer parallax-bg">
    &copy; Nozomi Hosaka
  </footer>
</template>

<script>
export default {
  name: 'TheFooter'
}
</script>

<style scoped lang="scss">
@import "assets/scss/variables";
.v-Footer {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  color: $lnk-black;
  background-color: $white;
  padding: 0 0 0 0 !important;
}
</style>
