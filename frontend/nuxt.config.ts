import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { normalizePreviewFlag } from './utils/env/isPreview'
import { loadArticlesFromFs } from './utils/prerender/loadArticlesFromFs'
import { buildPrerenderRoutes } from './utils/prerender/buildPrerenderRoutes'
import { buildTagsIndex } from './utils/prerender/buildTagsIndex'
import { collectSlugEntriesFromDirs } from './utils/prerender/collectSlugEntriesFromDirs'
import {
  detectSlugCollisions,
  formatSlugCollisionError,
} from './utils/prerender/detectSlugCollisions'
import { ARTICLES_TAG_ROUTE_PREFIX } from './constants/tags'
import { RSS_FEED_PATH } from './constants/rss'
import { buildOgpInputs } from './utils/ogp/buildOgpInputs'
import { writeArticleOgpPngs } from './utils/ogp/writeArticleOgpPngs'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkZennImage from './utils/markdown/remarkZennImage'
import remarkZennContainer from './utils/markdown/remarkZennContainer'
import remarkZennEmbed from './utils/markdown/remarkZennEmbed'
import remarkZennCard from './utils/markdown/remarkZennCard'
import remarkZennTweet from './utils/markdown/remarkZennTweet'
import remarkZennGist from './utils/markdown/remarkZennGist'
import remarkZennMermaid from './utils/markdown/remarkZennMermaid'
import rehypeAssertNoZennLeftovers from './utils/markdown/rehypeAssertNoZennLeftovers'
import type { FetchOgpFn } from './utils/markdown/remarkZennCard'
import type { OgpFailure } from './utils/ogp/fetchOgp'
import { fetchOgp } from './utils/ogp/fetchOgp'
import { createNodeHttpClient } from './utils/ogp/httpClient.node'
import { createFileSystemOgpCache } from './utils/ogp/ogpCache'
import { extractOgp } from './utils/ogp/extractOgp'
import { downloadImage } from './utils/ogp/downloadImage'
import { sanitizeOgp } from './utils/ogp/sanitizeOgp'
import {
  OGP_FETCH_MAX_BYTES,
  OGP_FETCH_MAX_REDIRECTS,
  OGP_FETCH_TIMEOUT_MS,
  OGP_USER_AGENT,
} from './constants/ogp'

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

// リポジトリ root 直下の記事ソースディレクトリ (v4)。
// v3 まで参照していた articles/ は generator の出力 (scripts/) になり、
// frontend は原典である site-articles/ のみを読み込む。`articles/` 側は
// Zenn Connect の入力として残るが、本サイトのビルドでは使わない。
const SITE_ARTICLES_DIR = resolve(__dirname, '../site-articles')
// Zenn CLI (`npx zenn preview`) は `/images/*` を repo root 直下の `images/`
// から配信する仕様。articles/ と site-articles/ の双方で同じパス記法
// (`/images/<slug>/foo.png`) を使えるよう、Nuxt 側の static 配信元も root の
// `images/` に合わせる。
const ARTICLES_IMAGES_DIR = resolve(__dirname, '../images')

/**
 * 記事 slug 衝突検知の対象ディレクトリ一覧 (v4)。
 * v4 では source が単一ディレクトリ (site-articles/) に統一されたため、
 * 異ディレクトリ間の衝突は起こらない。純関数 API を維持しつつ単一要素で
 * 呼び出す (slugs が OS 側で重複することは FS の仕様上起こり得ないので
 * 実質 no-op の安全網として残す)。
 */
const ARTICLE_SOURCE_DIRS = [SITE_ARTICLES_DIR] as const

// 自作 remark プラグイン (Zenn 互換画像パス書き換え) の絶対パス。
// @nuxtjs/mdc が生成する `mdc-imports.mjs` は `src` が指定されていれば
// そこから import するため、package 解決に失敗する警告を避けられる。
const REMARK_ZENN_IMAGE_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennImage.ts',
)

/**
 * 自作 remark プラグイン (`remarkZennContainer`) の絶対パス。
 * Zenn 独自のコンテナ記法 (`:::message` / `:::details`) を MDC
 * コンポーネント (`zenn-message` / `zenn-details`) に橋渡しする。
 */
const REMARK_ZENN_CONTAINER_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennContainer.ts',
)

/**
 * 自作 remark プラグイン (`remarkZennEmbed`) の絶対パス。
 * Zenn 独自の埋め込み記法 (`@[youtube](...)` 等) を MDC 埋め込み
 * コンポーネントに橋渡しし、URL/ID の正規化とバリデーションも行う。
 */
const REMARK_ZENN_EMBED_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennEmbed.ts',
)

/**
 * 自作 remark プラグイン (`remarkZennCard`) の絶対パス。
 * Zenn 独自の外部リンクカード記法 (`@[card](url)`) を build 時に
 * OGP 取得付きで MDC コンポーネントに変換する。
 */
const REMARK_ZENN_CARD_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennCard.ts',
)

/**
 * 自作 remark プラグイン (`remarkZennTweet`) の絶対パス。
 * `@[tweet](URL)` を `<zenn-embed-tweet>` MDC コンポーネントに変換する。
 */
const REMARK_ZENN_TWEET_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennTweet.ts',
)

/**
 * 自作 remark プラグイン (`remarkZennGist`) の絶対パス。
 * `@[gist](URL)` を `<zenn-embed-gist>` MDC コンポーネントに変換する。
 */
const REMARK_ZENN_GIST_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennGist.ts',
)

/**
 * 自作 remark プラグイン (`remarkZennMermaid`) の絶対パス。
 * ` ```mermaid ` コードフェンスを `<zenn-mermaid>` MDC コンポーネントに
 * 変換し、クライアント側での動的 import 描画に橋渡しする。
 */
const REMARK_ZENN_MERMAID_PATH = resolve(
  __dirname,
  './utils/markdown/remarkZennMermaid.ts',
)

/**
 * 自作 rehype プラグイン (`rehypeAssertNoZennLeftovers`) の絶対パス。
 * 未対応 Zenn 記法 (`@[card]` / `:::warning` 等) が rehype 段階で残留
 * していた場合にビルドを fail させる安全網。
 */
const REHYPE_ASSERT_NO_ZENN_LEFTOVERS_PATH = resolve(
  __dirname,
  './utils/markdown/rehypeAssertNoZennLeftovers.ts',
)

/**
 * KaTeX の組み込み CSS へのパス。`katex` パッケージが提供する
 * `dist/katex.min.css` を Nuxt の `css` オプションで読み込むことで、
 * `rehype-katex` が生成する `.katex` 要素に適切なフォント/レイアウトが
 * 適用される。直書きせず named 定数として切り出し、依存先パスが変わった
 * ときの影響範囲を 1 箇所に閉じ込める。
 */
const KATEX_CSS_PATH = 'katex/dist/katex.min.css'

/** articles 画像を公開配信するパス */
const ARTICLES_IMAGES_BASE_URL = '/articles-images'

/**
 * OGP 画像を書き出す publicDir 配下のサブディレクトリ名。
 * nitro の publicDir (`.output/public`) 配下に `/ogp/<slug>.png` として配置される。
 */
const OGP_OUTPUT_SUBDIR = 'ogp'

/**
 * Satori に渡すサブセット化済み Noto Sans JP フォントの絶対パス。
 * `scripts/subset-noto-sans-jp.mjs` で生成する成果物を参照する。
 */
const OGP_FONT_PATH = resolve(
  __dirname,
  'public/fonts/noto-sans-jp-subset.woff',
)

/** 予約投稿判定などに用いる prerender 実行時刻は常に現在時刻とする */
const getBuildTime = (): Date => new Date()

/**
 * OGP 取得関数を組み立てる。
 *
 *   - `NO_NETWORK_FETCH=1` (CI, ユニットテスト等) のときは常に failure を
 *     返す stub を返す (外部 fetch を 1 回も呼ばない)。
 *   - それ以外は `createNodeHttpClient` + `createFileSystemOgpCache` +
 *     `extractOgp` + `downloadImage` + `sanitizeOgp` を合成した本番実装を返す。
 *
 * 失敗時は remarkZennCard が fallback カードに倒すため、generate 全体は
 * 継続する。
 */
function buildFetchOgp(): FetchOgpFn {
  if (process.env.NO_NETWORK_FETCH === '1') {
    return async (url: string) => {
      const failure: OgpFailure = {
        ok: false,
        url,
        reason: 'no_network_fetch',
      }
      return failure
    }
  }
  const client = createNodeHttpClient()
  const cache = createFileSystemOgpCache()
  const imageDownloader = async (imageUrl: string): Promise<string | null> => {
    return downloadImage(imageUrl, { client })
  }
  return async (url: string) =>
    fetchOgp(url, {
      client,
      cache,
      sanitize: sanitizeOgp,
      // `extractOgp` は async (`Promise<RawOgp>`) だが fetchOgp 側は sync /
      // async 両対応 (`await` する) なのでそのまま渡せる。
      extractOgp,
      httpOptions: {
        timeoutMs: OGP_FETCH_TIMEOUT_MS,
        maxBytes: OGP_FETCH_MAX_BYTES,
        maxRedirects: OGP_FETCH_MAX_REDIRECTS,
        userAgent: OGP_USER_AGENT,
        credentials: 'omit',
      },
      now: () => Date.now(),
      imageDownloader,
    })
}

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
        // Zenn 互換記法を Nuxt Content の MDC / HAST パイプラインに繋ぐ
        // プラグイン群。Nuxt Content v3 (`@nuxtjs/mdc`) のデフォルトには
        // `remark-mdc` / `remark-gfm` / `remark2rehype` が含まれるため、
        // ここに追加したユーザー plugin はそれらの **後** に走る。
        //
        // remark の適用順序 (`Object.entries` 挿入順で `processor.use`):
        //   1. `remark-zenn-container`: `:::message` / `:::details` を
        //      `zenn-*` MDC コンテナに昇格 / リネーム
        //   2. `remark-zenn-embed`:     `@[service](url)` を
        //      `zenn-embed-*` MDC コンテナに昇格 (URL 正規化 + バリデーション)
        //   3. `remark-zenn-card`:      `@[card](url)` を `zenn-embed-card` に
        //      昇格し、build 時に OGP を取得して props を埋め込む
        //      (NO_NETWORK_FETCH=1 時は failure stub で fallback)
        //   4. `remark-zenn-tweet`:     `@[tweet](url)` を `zenn-embed-tweet` に
        //      昇格 (Twitter/X URL から Tweet ID 抽出 + バリデーション)
        //   5. `remark-zenn-gist`:      `@[gist](url)` を `zenn-embed-gist` に
        //      昇格 (Gist URL から user/id 抽出 + バリデーション)
        //   6. `remark-zenn-mermaid`:   ` ```mermaid ` コードフェンスを
        //      `<zenn-mermaid>` MDC コンポーネントに昇格 (クライアント側で
        //      動的 import して描画)
        //   7. `remark-zenn-image`:     Zenn の `/images/...` を
        //      `/articles-images/...` に書き換え
        //   8. `remark-math`:           `$...$` / `$$...$$` を math ノードに
        //                               昇格 (後段 rehype-katex が HTML 化)
        //
        // rehype:
        //   1. `rehype-katex`:                     math ノードを KaTeX HTML に変換
        //   2. `rehype-assert-no-zenn-leftovers`:  末尾に配置。未対応記法が
        //                                          残っていれば throw して
        //                                          build fail させる安全網
        remarkPlugins: {
          'remark-zenn-container': {
            instance: remarkZennContainer,
            src: REMARK_ZENN_CONTAINER_PATH,
            options: {},
          },
          'remark-zenn-embed': {
            instance: remarkZennEmbed,
            src: REMARK_ZENN_EMBED_PATH,
            options: {},
          },
          'remark-zenn-card': {
            instance: remarkZennCard,
            src: REMARK_ZENN_CARD_PATH,
            options: {
              fetchOgp: buildFetchOgp(),
            },
          },
          'remark-zenn-tweet': {
            instance: remarkZennTweet,
            src: REMARK_ZENN_TWEET_PATH,
            options: {},
          },
          'remark-zenn-gist': {
            instance: remarkZennGist,
            src: REMARK_ZENN_GIST_PATH,
            options: {},
          },
          'remark-zenn-mermaid': {
            instance: remarkZennMermaid,
            src: REMARK_ZENN_MERMAID_PATH,
            options: {},
          },
          'remark-zenn-image': {
            instance: remarkZennImage,
            src: REMARK_ZENN_IMAGE_PATH,
            options: {},
          },
          'remark-math': {
            instance: remarkMath,
            options: {},
          },
        },
        rehypePlugins: {
          'rehype-katex': {
            instance: rehypeKatex,
            options: {},
          },
          'rehype-assert-no-zenn-leftovers': {
            instance: rehypeAssertNoZennLeftovers,
            src: REHYPE_ASSERT_NO_ZENN_LEFTOVERS_PATH,
            options: {},
          },
        },
      },
    },
  },

  runtimeConfig: {
    // ビルド時に書き出すタグ index (JSON 文字列)。
    // 実値は `nitro:config` hook で決定し、server handler
    // (`server/routes/tags.json.get.ts`) から参照する。
    // server 専用の情報なので `public` 配下には置かない。
    tagsIndexJson: '{}',
    public: {
      // サーバ/クライアントで共有されるプレビュー制御フラグ。
      // `CONTENT_PREVIEW` の正規化結果と NODE_ENV の組み合わせで決定する。
      // クライアント側からも参照するため `public` に配置する。
      contentPreview: isContentPreviewEnabled,
      baseUrl: 'https://nozomi.bike',
      // GA4 測定 ID。ビルド時に `NUXT_PUBLIC_GTAG_ID` 環境変数から注入する
      // (Nuxt の auto env mapping: `NUXT_PUBLIC_*` → `runtimeConfig.public.*`)。
      // 未設定時は空文字にフォールバックし、`plugins/gtag.client.ts` 側の
      // 有効化判定 (`isAnalyticsEnabled`) で fail-closed に倒れる。
      gtagId: process.env.NUXT_PUBLIC_GTAG_ID ?? '',
    },
  },

  nitro: {
    // ADR V-2: Zenn Connect / Zenn CLI 互換のため、リポジトリ root 直下の
    // `images/` を `/articles-images/` として静的配信する。remarkZennImage が
    // Markdown 内の `/images/...` を `/articles-images/...` に書換える。
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
      // `/feed.xml` は Phase 4 Batch A の RSS 配信パス。generate 時に
      // `.output/public/feed.xml` として emit される。
      routes: ['/', '/articles', RSS_FEED_PATH],
    },
  },

  hooks: {
    // ビルド時に articles の frontmatter を列挙し、prerender 対象に追加する。
    // Nuxt Content v3 の `queryCollection` は server runtime API なので
    // build hook からは使えない。gray-matter で frontmatter を直接パースする
    // fallback を採用 (ADR Phase 1 で合意済み)。
    //
    // タグ index は nitro server handler (`server/routes/tags.json.get.ts`)
    // 経由で `/tags.json` として配信する。prerender 時に `crawlLinks` で
    // 踏まれたときにも静的ファイル `.output/public/tags.json` が emit される。
    // その生データ (JSON 文字列) は `runtimeConfig.tagsIndexJson` としてここで
    // 固めて server handler に渡す。
    'nitro:config'(nitroConfig) {
      // dev モード (nuxt dev) では prerender 経路自体が無効なため早期 return。
      if (nitroConfig.dev) {
        return
      }
      // articles/ と site-articles/ に同じ slug の記事が存在するとどちらが
      // 優先されるか不定になるため、ビルドを明示的に失敗させる。
      const collisions = detectSlugCollisions(
        collectSlugEntriesFromDirs(ARTICLE_SOURCE_DIRS),
      )
      if (collisions.length > 0) {
        throw new Error(formatSlugCollisionError(collisions))
      }
      const nodeEnv = process.env.NODE_ENV
      // production build では preview を必ず false に倒す (fail-closed)。
      // それ以外 (local generate 等) は CONTENT_PREVIEW の値を尊重する。
      const preview =
        nodeEnv === 'production'
          ? false
          : normalizePreviewFlag(process.env.CONTENT_PREVIEW)
      const articles = loadArticlesFromFs(ARTICLE_SOURCE_DIRS)
      const buildTime = getBuildTime()
      const routes = buildPrerenderRoutes(articles, buildTime, {
        preview,
        nodeEnv,
      })
      // タグ index をビルド時点で確定し、prerender 対象のタグページ URL と
      // server handler が返す JSON の両方を同じデータから生成する
      // (両者がズレるとタグページ 404 の原因になる)。
      const tagsIndex = buildTagsIndex(articles, buildTime, {
        preview,
        nodeEnv,
      })
      const tagRoutes = Object.keys(tagsIndex).map(
        (tag) => `${ARTICLES_TAG_ROUTE_PREFIX}${tag}`,
      )
      nitroConfig.prerender = nitroConfig.prerender ?? {}
      nitroConfig.prerender.routes = [
        ...(nitroConfig.prerender.routes ?? []),
        ...routes,
        ...tagRoutes,
        // `/tags.json` 自体も prerender 対象に含めることで、
        // generate 成果物 `.output/public/tags.json` として emit される。
        '/tags.json',
      ]
      // server handler がランタイムで参照するデータ。`tagsIndex` そのものでも
      // 良いが、runtimeConfig 上は JSON 文字列として固めた方が h3 側で
      // `JSON.parse` → 返却の単純な経路で済む。
      nitroConfig.runtimeConfig = nitroConfig.runtimeConfig ?? {}
      nitroConfig.runtimeConfig.tagsIndexJson = JSON.stringify(tagsIndex)
    },

    // 公開対象の記事ごとに OGP PNG を並列生成し、`.output/public/ogp/<slug>.png`
    // に書き出す。`nitro:build:public-assets` は public/ の初期コピー後、
    // Nitro server ビルドの前に呼ばれるため、ここで書き込めば static asset と
    // して扱える。preview モードでは素の content が OGP に漏れるリスクを避け
    // るためスキップする (設計 v4 C-B)。
    async 'nitro:build:public-assets'(nitro) {
      const nodeEnv = process.env.NODE_ENV
      const preview =
        nodeEnv === 'production'
          ? false
          : normalizePreviewFlag(process.env.CONTENT_PREVIEW)
      if (preview) {
        return
      }
      const articles = loadArticlesFromFs(ARTICLE_SOURCE_DIRS)
      const buildTime = getBuildTime()
      const entries = buildOgpInputs(articles, {
        preview,
        nodeEnv,
        buildTime,
      })
      if (entries.length === 0) {
        return
      }
      const fontBuffer = readFileSync(OGP_FONT_PATH)
      const publicDir: string = nitro.options.output.publicDir
      const outputDir = resolve(publicDir, OGP_OUTPUT_SUBDIR)
      await writeArticleOgpPngs(entries, {
        outputDir,
        fontBuffer,
        logger: (msg) => console.info(msg),
      })
    },
  },

  css: [
    '@/assets/scss/app.scss',
    '@fortawesome/fontawesome-svg-core/styles.css',
    'material-icons/iconfont/material-icons.css',
    '@fontsource/noto-sans-jp/japanese.css',
    KATEX_CSS_PATH,
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
        // `og:image:alt` は Phase 0 以前の "Business card" が残っており、
        // 現サイトの記事/ポートフォリオ用途と一致しないため削除。記事別の
        // 動的 alt は後続 Phase で検討する (今は未設定のほうが誤表示より
        // 安全)。
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    },
  },

  compatibilityDate: '2024-09-20'
})
