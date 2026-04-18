<template>
  <div>
    <the-header />
    <main>
      <slot />
    </main>
    <the-footer />
  </div>
</template>

<script setup lang="ts">
import TheHeader from '~/components/TheHeader.vue'
import TheFooter from '~/components/TheFooter.vue'
</script>