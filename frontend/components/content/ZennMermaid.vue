<template>
  <div class="mermaid-wrapper">
    <ClientOnly>
      <div
        v-if="!hasError"
        ref="container"
        class="mermaid-rendered"
        aria-label="Mermaid diagram"
      />
      <pre v-else class="mermaid-fallback"><code>{{ code }}</code></pre>
      <template #fallback>
        <pre class="mermaid-fallback"><code>{{ code }}</code></pre>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
/**
 * Zenn 互換の ` ```mermaid ... ``` ` コードフェンスに対応する MDC コンポーネント。
 *
 * 設計要点:
 *   - mermaid ライブラリは DOM / window / document に依存するため、SSR 段階で
 *     読み込むと `window is not defined` で失敗する。`<ClientOnly>` 配下で
 *     動的 import し、`onMounted` 内でのみ `render` を呼ぶ
 *   - SSR / prerender / 初期 HTML では `<template #fallback>` で原文の
 *     `<pre><code>` を出力し、JS 無効環境でも DSL が読める状態を担保する
 *   - `securityLevel: 'strict'` 固定で初期化し、mermaid の `click` ディレクティブ
 *     経由で任意 JS が実行されるのを抑制する (設計 v4 Sec Minor 指摘対応)
 *   - mermaid.render が返す SVG は `innerHTML` で DOM に注入する。これは
 *     mermaid が生成した信頼できる SVG 文字列であり、`securityLevel: 'strict'`
 *     によって任意の `<script>` や `click` は含まれない想定。追加の DOMPurify
 *     は将来検討 (v4 設計に記載)
 *   - 描画失敗時 (不正 DSL / 例外) は catch して `hasError` を立て、`<pre><code>`
 *     fallback に切り替える。静かな画面壊れではなく、原文の可視化を優先する
 *
 * props:
 *   - code: Mermaid DSL (例: `graph TD\nA --> B`)
 */
import { onMounted, ref } from 'vue'
import { MERMAID_UNIQUE_ID_PREFIX } from '../../constants/zenn-embed'

interface Props {
  /**
   * Mermaid DSL 本文。`<zenn-mermaid code="...">` の code attribute として
   * 渡される。
   */
  code: string
}

const props = defineProps<Props>()

/**
 * 描画先の DOM 参照。`<ClientOnly>` + `v-if` 配下のため、SSR 時や初期化前は
 * null になりうる。`onMounted` で触るときは null チェック必須。
 */
const container = ref<HTMLDivElement | null>(null)

/**
 * 描画失敗フラグ。true の場合、レンダリング済み SVG 要素を出さず `<pre><code>`
 * fallback に切り替える。
 */
const hasError = ref<boolean>(false)

/**
 * `mermaid.render(id, code)` で使う一意 ID を生成する。
 *
 * `crypto.randomUUID()` が利用できる環境 (modern browsers, Node 20+) では
 * それを使い、不可の環境では `Math.random` + タイムスタンプで fallback する。
 * 同一ページ内で複数の diagram が共存するときに ID 衝突させないことが目的。
 */
function buildUniqueId(): string {
  const suffix = buildRandomSuffix()
  return `${MERMAID_UNIQUE_ID_PREFIX}${suffix}`
}

/**
 * ランダムな suffix を生成する。`crypto.randomUUID` があれば先頭 8 文字、
 * なければ `Math.random().toString(36)` の先頭 8 文字 + 時刻末尾で fallback。
 */
function buildRandomSuffix(): string {
  const RANDOM_SUFFIX_LENGTH = 8
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID().slice(0, RANDOM_SUFFIX_LENGTH)
  }
  const randomPart = Math.random()
    .toString(36)
    .slice(2, 2 + RANDOM_SUFFIX_LENGTH)
  const timePart = Date.now().toString(36)
  return `${randomPart}${timePart}`
}

/**
 * クライアント起動時に mermaid を動的 import して描画する。
 *
 * `<ClientOnly>` が SSR 時に body をスキップするため、`onMounted` 経路は
 * クライアント側の初回描画でのみ実行される。`container.value` が null の
 * ときは初期化しない (描画先が用意できていない)。
 */
onMounted(async () => {
  if (container.value === null) {
    return
  }
  if (props.code.length === 0) {
    // 空コードフェンス。mermaid.render に投げても意味がないので fallback。
    hasError.value = true
    return
  }
  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
    })
    const { svg } = await mermaid.render(buildUniqueId(), props.code)
    if (container.value !== null) {
      // mermaid が securityLevel: 'strict' で生成した SVG 文字列は、内部で
      // click ディレクティブの JS 実行が抑制された安全な markup。ここでの
      // innerHTML 注入は Vue の v-html 相当の意図的操作 (DOMPurify の追加
      // 適用は将来検討)。
      container.value.innerHTML = svg
    }
  }
  catch {
    hasError.value = true
  }
})
</script>

<style scoped lang="scss">
.mermaid-wrapper {
  margin: 1rem 0;
  display: flex;
  justify-content: center;
}

.mermaid-rendered {
  max-width: 100%;
  overflow-x: auto;

  :deep(svg) {
    max-width: 100%;
    height: auto;
  }
}

.mermaid-fallback {
  max-width: 100%;
  padding: 0.75rem 1rem;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 0.4rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;

  code {
    font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
    font-size: 0.85rem;
  }
}
</style>
