<template>
  <div>
    <the-header />
    <main>
      <Nuxt />
    </main>
    <the-footer />
  </div>
</template>
<script>
import TheHeader from '~/components/TheHeader'
import TheFooter from '~/components/TheFooter'

export default {
  components: { TheFooter, TheHeader }
}
</script>
