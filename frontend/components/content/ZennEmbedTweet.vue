<template>
  <ClientOnly>
    <blockquote
      class="twitter-tweet"
      :data-tweet-id="id"
    >
      <a
        v-if="isSafe"
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
      >View tweet on Twitter</a>
    </blockquote>
    <template #fallback>
      <blockquote class="twitter-tweet-fallback">
        <a
          v-if="isSafe"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
        >View tweet on Twitter</a>
      </blockquote>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
/**
 * Zenn 独自記法 `@[tweet](URL)` に対応する MDC コンポーネント。
 *
 * 設計要点:
 *   - SSR / 初期 HTML では `<blockquote class="twitter-tweet">` 内に tweet
 *     への `<a>` リンクのみを出力する。widgets.js がロードされれば DOM を
 *     iframe に差し替える仕様 (Twitter 公式の埋め込み手順)
 *   - `<ClientOnly>` の `#fallback` (SSR / JS 無効環境) でも同じリンクだけは
 *     残し、本文の崩れを最小化する
 *   - `onMounted` で `<head>` に widgets.js を動的挿入する。既に同じ script
 *     タグが存在する場合は二重ロードを避けて `window.twttr.widgets.load()`
 *     を呼び、遅延で追加された blockquote を再描画させる
 *   - `url` props は remark 側 validator を通過した値のみが来る想定だが、
 *     深層防御として `isSafeHref` でスキームを再検証し、非許容なら `<a>` を
 *     描画しない (テキストのみのまま)
 *
 * props:
 *   - id:  Tweet ID (数字文字列)。data 属性として widgets.js の hint に渡す
 *   - url: 元 Tweet URL。fallback `<a>` の href として使用
 */
import { computed, onMounted } from 'vue'
import { TWEET_WIDGETS_SCRIPT_URL } from '../../constants/zenn-embed'

interface Props {
  /** Tweet ID (例: `1234567890123456789`)。 */
  id: string
  /** 元 Tweet URL。fallback リンクの href。 */
  url: string
}

const props = defineProps<Props>()

/**
 * href として安全な URL か。テンプレート側の深層防御。
 *
 * - 絶対 URL である
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
 * `window.twttr` を型付きで参照するための宣言。widgets.js が注入する
 * グローバル。`load()` は既存の DOM を走査して未変換の blockquote を再
 * レンダリングさせる関数。
 */
interface TwttrWidgets {
  readonly widgets: {
    readonly load: (element?: HTMLElement | null) => void
  }
}

/**
 * widgets.js の script を `<head>` に動的挿入する。
 *
 * 既に同じ src が存在すれば二重挿入はせず、`window.twttr.widgets.load()` を
 * 呼ぶことで既存の script が追加 blockquote を認識できるようにする。
 */
function ensureWidgetsScriptLoaded(): void {
  if (typeof document === 'undefined') {
    return
  }
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${TWEET_WIDGETS_SCRIPT_URL}"]`,
  )
  if (existing !== null) {
    const twttr = (window as unknown as { twttr?: TwttrWidgets }).twttr
    if (twttr !== undefined) {
      try {
        twttr.widgets.load()
      }
      catch {
        // widgets.load() の失敗は致命的ではないので握り潰す。fallback blockquote
        // は既に描画されているため体験は維持される。
      }
    }
    return
  }
  const script = document.createElement('script')
  script.src = TWEET_WIDGETS_SCRIPT_URL
  script.async = true
  // 他の文書から参照される想定がない script なので `charset` 等は省略。
  document.head.appendChild(script)
}

onMounted(() => {
  ensureWidgetsScriptLoaded()
})
</script>

<style scoped lang="scss">
.twitter-tweet,
.twitter-tweet-fallback {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 0.4rem;
  background-color: #fff;
  font-size: 0.9rem;
  line-height: 1.5;

  a {
    color: #1d9bf0;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
