// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: [
    '@/assets/scss/app.scss',
    '@fortawesome/fontawesome-svg-core/styles.css',
    'material-icons/iconfont/material-icons.css',
    '@fontsource/noto-sans-jp/japanese.css',
  ],
  app: {
    head: {
      htmlAttrs: {
        lang: 'ja'
      },
      title: 'Nozomi Hosaka',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'https://nozomi.bike' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@nonz250' },
        { name: 'fb:app_id', content: '370746857063202' },
        { name: 'og:type', content: 'website' },
        { name: 'og:site_name', content: 'Nozomi Hosaka' },
        { name: 'og:title', content: 'Nozomi Hosaka' },
        { name: 'og:description', content: 'https://nozomi.bike' },
        { name: 'og:url', content: 'https://nozomi.bike' },
        { name: 'og:image', content: 'https://nozomi.bike/images/homepage-ogp.webp' },
        { name: 'og:image:alt', content: 'Business card' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    },
  }
})
