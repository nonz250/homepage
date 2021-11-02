<template>
  <footer class="v-Footer">
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
  color: $white;
  background-color: $lab-blue;
}
</style>
