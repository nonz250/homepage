import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { normalizePreviewFlag } from './utils/env/isPreview'
import { loadArticlesFromFs } from './utils/prerender/loadArticlesFromFs'
import { buildPrerenderRoutes } from './utils/prerender/buildPrerenderRoutes'
import remarkZennImage from './utils/markdown/remarkZennImage'

// CONTENT_PREVIEW 環境変数を正規化した上で、本番ビルドでは常に無効化する。
// `normalizePreviewFlag` は純関数なのでここで評価して runtimeConfig に固める。
const isPreviewEnv = normalizePreviewFlag(process.env.CONTENT_PREVIEW)
const isProductionBuild = process.env.NODE_ENV === 'production'
const isContentPreviewEnabled = isPreviewEnv && !isProductionBuild

// ES Module 上で __dirname を取得するための定型処理。
// nuxt.config.ts は Nuxt ランタイム経由で評価されるため、
// import.meta.url が利用できる。
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// リポジトリ root 直下の articles ディレクトリ (ADR V-1/V-2 参照)。
const ARTICLES_DIR = resolve(__dirname, '../articles')
const ARTICLES_IMAGES_DIR = resolve(__dirname, '../articles/images')

// 自作 remark プラグイン (Zenn 互換画像パス書き換え) の絶対パス。
// @nuxtjs/mdc が生成する `mdc-imports.mjs` は `src` が指定されていれば
// そこから import するため、package 解決に失敗する警告を避けられる。
const REMARK_ZENN_IMAGE_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennImage.ts',
)

/** articles 画像を公開配信するパス */
const ARTICLES_IMAGES_BASE_URL = '/articles-images'

/** 予約投稿判定などに用いる prerender 実行時刻は常に現在時刻とする */
const getBuildTime = (): Date => new Date()

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SSG (prerender) を有効化するため、SSR を明示的に true に設定する。
  // Nuxt 3 のデフォルトは true だが、設計 v4 の 6.3 節に従って明示する。
  ssr: true,

  modules: [
    '@nuxt/content',
  ],

  // Nuxt Content v3 のモジュールオプション。
  // remarkZennImage は Zenn 互換の `/images/...` 参照を
  // `/articles-images/...` に書き換える最小プラグイン (Phase 1)。
  //
  // `@nuxt/content` の parser は `instance` を優先し、未指定なら
  // key 名 (`remark-zenn-image`) から dynamic import しようとする。
  // `@nuxtjs/mdc` の mdc-imports 生成は `src` を見る。
  // 両パイプラインを満たすため instance / src の両方を指定する。
  content: {
    build: {
      markdown: {
        remarkPlugins: {
          'remark-zenn-image': {
            instance: remarkZennImage,
            src: REMARK_ZENN_IMAGE_PATH,
            // @nuxtjs/mdc の mdc-imports テンプレートが options 未指定
            // 時に plugin オブジェクト全体を渡してしまう挙動の回避。
            options: {},
          },
        },
      },
    },
  },

  runtimeConfig: {
    public: {
      // サーバ/クライアントで共有されるプレビュー制御フラグ。
      // `CONTENT_PREVIEW` の正規化結果と NODE_ENV の組み合わせで決定する。
      // クライアント側からも参照するため `public` に配置する。
      contentPreview: isContentPreviewEnabled,
      baseUrl: 'https://nozomi.bike',
    },
  },

  nitro: {
    // ADR V-2: Zenn Connect 互換のため、リポジトリ root 直下の
    // `articles/images/` を `/articles-images/` として静的配信する。
    publicAssets: [
      {
        dir: ARTICLES_IMAGES_DIR,
        baseURL: ARTICLES_IMAGES_BASE_URL,
      },
    ],
    prerender: {
      // 参照切れ (dead link) がある場合、静的ホスティングで 404 を
      // 生みやすいので build 時に検知して失敗させる。
      failOnError: true,
      // ページ内の <a> 要素をたどって追加ルートを検出する。
      // 既知の動的ルートは `routes` / `nitro:config` hook で明示する。
      crawlLinks: true,
      // 明示的に prerender する静的ルート。articles 個別ページの
      // 動的ルートは `nitro:config` hook 内で追加する。
      routes: ['/', '/articles'],
    },
  },

  hooks: {
    // ビルド時に articles の frontmatter を列挙し、prerender 対象に追加する。
    // Nuxt Content v3 の `queryCollection` は server runtime API なので
    // build hook からは使えない。gray-matter で frontmatter を直接パースする
    // fallback を採用 (ADR Phase 1 で合意済み)。
    'nitro:config'(nitroConfig) {
      // dev モード (nuxt dev) では prerender 経路自体が無効なため早期 return。
      if (nitroConfig.dev) {
        return
      }
      const nodeEnv = process.env.NODE_ENV
      // production build では preview を必ず false に倒す (fail-closed)。
      // それ以外 (local generate 等) は CONTENT_PREVIEW の値を尊重する。
      const preview =
        nodeEnv === 'production'
          ? false
          : normalizePreviewFlag(process.env.CONTENT_PREVIEW)
      const articles = loadArticlesFromFs(ARTICLES_DIR)
      const routes = buildPrerenderRoutes(articles, getBuildTime(), {
        preview,
        nodeEnv,
      })
      nitroConfig.prerender = nitroConfig.prerender ?? {}
      nitroConfig.prerender.routes = [
        ...(nitroConfig.prerender.routes ?? []),
        ...routes,
      ]
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
