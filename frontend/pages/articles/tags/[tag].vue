<script setup lang="ts">
/**
 * タグ別記事一覧ページ `/articles/tags/[tag]`。
 *
 * ビルド時に書き出した `.output/public/tags.json` を `useTagIndex` 経由で
 * 読み込み、該当タグの slug 一覧と `useArticles()` で取得済みの記事メタを
 * 突き合わせて一覧表示する。
 *
 * 404 条件:
 *   - `tags.json` に該当 tag が存在しない
 *   - マッチする記事が preview 可視性フィルタ通過後に 0 件
 *   いずれも `createError({ statusCode: 404 })` で 404 ページに遷移する
 *
 * レイアウトは `/articles` 一覧と同じく parallax-bg ヘッダ + graph リスト
 * の交互構造。UI コンポーネントは `ArticleCard` を流用し、タグページ固有の
 * 見た目差分は最小限に留める (DRY)。
 */
import ArticleCard from '~/components/parts/ArticleCard.vue'
import { useArticles } from '~/composables/useArticles'
import { useContentPreview } from '~/composables/useContentPreview'
import { useTagIndex } from '~/composables/useTagIndex'

/** `<h1>` に表示するタグ表示のフォーマット (`#<tag>` / `# <tag>`) */
const TAG_HEADING_PREFIX = '#'

const route = useRoute()
// `[tag]` は通常 string で渡るが、配列で来る可能性も吸収する。
const tagParam = route.params.tag
const tag = Array.isArray(tagParam) ? tagParam.join('/') : String(tagParam)

const preview = useContentPreview()
const tagIndex = await useTagIndex()
const slugsForTag = tagIndex[tag]

// tags.json に該当 tag が存在しない時点で 404。
// タグ index は build hook で生成するため、存在しないキーは絶対に何も
// 該当しない (ビルドの入力とページの入力が同じ articles 群なので).
if (!slugsForTag || slugsForTag.length === 0) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Tag not found',
    fatal: true,
  })
}

// 記事メタは useArticles() から全件取得し、slug マップに変換してから
// タグの slug 配列で filter する。`useArticle(slug)` を N 回呼ぶ方式より
// SQL クエリ数が減り、Nuxt Content の bundled DB にも優しい。
const allArticles = await useArticles({ preview })
const articlesBySlug = new Map(allArticles.map((a) => [a.slug, a]))
const articles = slugsForTag
  .map((slug) => articlesBySlug.get(slug))
  .filter((a): a is NonNullable<typeof a> => a !== undefined)

// preview フィルタを通した後にヒットが 0 件でも 404。
// (preview=false で draft しか含まないタグが公開されたケースを想定)
if (articles.length === 0) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Tag not found',
    fatal: true,
  })
}

const pageTitle = `${TAG_HEADING_PREFIX}${tag}`
const pageDescription = `${pageTitle} の記事一覧です (${articles.length} 件)。`

useHead({
  title: `${pageTitle} - Articles | Nozomi Hosaka`,
  meta: [
    { name: 'description', content: pageDescription },
    { property: 'og:title', content: `${pageTitle} - Articles` },
    { property: 'og:description', content: pageDescription },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<template>
  <main>
    <div class="parallax-bg">
      <section class="content tag-header">
        <h1 class="page-title">
          {{ pageTitle }}
        </h1>
        <p class="page-subtitle">
          {{ articles.length }} 件の記事
        </p>
      </section>
    </div>
    <div class="graph">
      <section class="content tag-articles-section">
        <ul class="article-list">
          <li v-for="article in articles" :key="article.slug" class="article-list-item">
            <article-card :article="article" :is-draft="preview && !article.published" />
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<style scoped lang="scss">
@use "assets/scss/color";

.tag-header {
  padding-top: 1rem;
}

.tag-articles-section {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.page-title {
  margin: 0;
  padding: 0;
  font-size: 2rem;
  font-weight: normal;

  @media screen and (max-width: 600px) {
    font-size: 1.6rem;
  }
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: color.$lnk-black;
  font-size: 0.9rem;
}

.article-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.article-list-item {
  width: 100%;
}
</style>
