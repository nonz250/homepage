import { defineNuxtPlugin } from "#app"
import VueScrollTo from 'vue-scrollto'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueScrollTo, {
    duration: 700,
    offset: -50
  })
})
