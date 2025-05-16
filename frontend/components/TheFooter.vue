<template>
  <footer class="v-Footer parallax-bg">
    &copy; Nozomi Hosaka
  </footer>
</template>

<script setup lang="ts">

</script>

<style scoped lang="scss">
@use "assets/scss/color";
.v-Footer {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  color: color.$lnk-black;
  background-color: color.$white;
  padding: 0 0 0 0 !important;
}
</style>
