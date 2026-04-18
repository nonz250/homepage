<template>
  <a
    v-if="isSafe"
    class="card"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
  >
    <div v-if="hasImage" class="card__image">
      <img :src="safeImagePath" alt="" loading="lazy" />
    </div>
    <div class="card__body">
      <div class="card__title">{{ title }}</div>
      <div v-if="description" class="card__description">{{ description }}</div>
      <div class="card__meta">
        <span v-if="siteName" class="card__site-name">{{ siteName }}</span>
        <span class="card__host">{{ host }}</span>
      </div>
    </div>
  </a>
  <span v-else class="card card--disabled">
    <div class="card__body">
      <div class="card__title">{{ title }}</div>
      <div class="card__meta">
        <span class="card__host">{{ host }}</span>
      </div>
    </div>
  </span>
</template>

<script setup lang="ts">
/**
 * Zenn 独自記法 `@[card](URL)` に対応する MDC コンポーネント。
 *
 * 設計要点:
 *   - テキスト系 (title / description / host / siteName) は mustache 補間
 *     のみを使い、`v-html` は一切使わない。XSS 面を狭める。
 *   - `:href` / `:src` は Vue のテンプレート属性バインディングを経由するため
 *     自動エスケープされる。加えて深層防御として `isSafeHref(url)` で
 *     スキーム (`http:` / `https:`) を明示的に検証し、非許容なら `<a>` では
 *     なく `<span>` にフォールバックする (= リンクを発火させない)。
 *   - 外部リンクなので `target="_blank"` + `rel="noopener noreferrer"` を
 *     必ず設定し、`window.opener` 経由の逆引き / tab nabbing を防ぐ。
 *
 * props:
 *   - title: OGP 取得 / fallback のタイトル。必ず文字列が入る。
 *   - description: og:description。空文字は非表示。
 *   - url: 元 URL。静的検査済み前提だがテンプレート側でも再検証する。
 *   - imagePath: 自サーバ保存パス or null/undefined/空文字。空扱いで非表示。
 *   - siteName: og:site_name。空なら非表示。
 */
import { computed } from 'vue'

interface Props {
  title: string
  description?: string
  url: string
  imagePath?: string | null
  siteName?: string | null
}

const props = defineProps<Props>()

/**
 * href として安全な URL か。テンプレート側の深層防御。
 *
 * - 絶対 URL であること
 * - スキームが `http:` または `https:`
 *
 * `new URL` 生成時に例外が出るもの、相対 URL、`javascript:` 等は `false`。
 */
function isSafeHref(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

const isSafe = computed<boolean>(() => isSafeHref(props.url))

/**
 * `imagePath` が意味のある値 (空文字 / null / undefined 以外) を持つか。
 * MDC から `attributes['image-path']` が文字列で渡るため、空文字を null 相当
 * として扱う。
 */
const hasImage = computed<boolean>(
  () =>
    typeof props.imagePath === 'string' &&
    props.imagePath.length > 0,
)

/**
 * `<img :src>` 用の非 null 型化済み path。`hasImage` が true のときにだけ
 * 描画される想定のため、undefined にフォールバックしておけば安全。
 */
const safeImagePath = computed<string | undefined>(() =>
  hasImage.value ? (props.imagePath as string) : undefined,
)

/**
 * meta 表示用のホスト名。URL が invalid な場合は raw を返す。
 */
const host = computed<string>(() => {
  try {
    return new URL(props.url).hostname
  }
  catch {
    return props.url
  }
})

// description が空文字の場合に `v-if="description"` で falsey 判定させるため、
// 明示的な computed は置かず直接 props を参照する。
// siteName も同様。null/undefined/空文字で非表示となる。
void props
</script>

<style scoped lang="scss">
.card {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  margin: 1.25rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 0.4rem;
  background-color: #fff;
  color: inherit;
  text-decoration: none;
  transition: box-shadow 0.15s ease-in-out;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
}

.card__image {
  flex-shrink: 0;
  width: 6rem;
  height: 4rem;
  overflow: hidden;
  border-radius: 0.25rem;
  background-color: #f2f2f2;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card__title {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.card__description {
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.6);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.card__meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.5);
}

.card__site-name {
  &::after {
    content: '·';
    margin-left: 0.5rem;
  }
}
</style>
