import { normalizePreviewFlag } from './utils/env/isPreview'

// CONTENT_PREVIEW 環境変数を正規化した上で、本番ビルドでは常に無効化する。
// `normalizePreviewFlag` は純関数なのでここで評価して runtimeConfig に固める。
const isPreviewEnv = normalizePreviewFlag(process.env.CONTENT_PREVIEW)
const isProductionBuild = process.env.NODE_ENV === 'production'
const isContentPreviewEnabled = isPreviewEnv && !isProductionBuild

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SSG (prerender) を有効化するため、SSR を明示的に true に設定する。
  // Nuxt 3 のデフォルトは true だが、設計 v4 の 6.3 節に従って明示する。
  ssr: true,

  modules: [
    '@nuxt/content',
  ],

  runtimeConfig: {
    // サーバ/クライアントで共有されるプレビュー制御フラグ。
    // `CONTENT_PREVIEW` の正規化結果と NODE_ENV の組み合わせで決定する。
    contentPreview: isContentPreviewEnabled,
    public: {
      baseUrl: 'https://nozomi.bike',
    },
  },

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
        { property: 'fb:app_id', content: '370746857063202' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Nozomi Hosaka' },
        { property: 'og:title', content: 'Nozomi Hosaka' },
        { property: 'og:description', content: 'https://nozomi.bike' },
        { property: 'og:url', content: 'https://nozomi.bike' },
        { property: 'og:image', content: 'https://nozomi.bike/images/homepage-ogp.webp' },
        { property: 'og:image:alt', content: 'Business card' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    },
  },

  compatibilityDate: '2024-09-20'
})