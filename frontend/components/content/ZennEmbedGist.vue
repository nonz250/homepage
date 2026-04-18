<template>
  <ClientOnly>
    <div
      ref="container"
      class="gist-container"
      :data-gist-user="user"
      :data-gist-id="id"
    />
    <template #fallback>
      <p class="gist-fallback">
        <a
          v-if="isSafe"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
        >View on Gist</a>
      </p>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
/**
 * Zenn 独自記法 `@[gist](URL)` に対応する MDC コンポーネント。
 *
 * 設計要点:
 *   - `<ClientOnly>` 配下で `<div ref=container>` を描画し、`onMounted` で
 *     `<script src="https://gist.github.com/<user>/<id>.js">` を挿入する。
 *     Gist の公式埋め込み方式に倣う
 *   - Gist script は読み込み時に `document.write` を用いる古い形式だが、
 *     `onMounted` 後 (= body 構築後) に差し込まれた場合、ブラウザは append
 *     相当に解釈するため実害は限定的。厳密な隔離 (iframe srcdoc 化) は
 *     将来の強化課題として ADR に残す
 *   - SSR / JS 無効環境では `<ClientOnly>` の `#fallback` が Gist への
 *     外部リンクのみを描画する
 *   - `url` props は深層防御として `isSafeHref` でスキーム検証し、非許容なら
 *     fallback の `<a>` を出さない
 *
 * props:
 *   - user: Gist owner (GitHub ユーザ名)
 *   - id:   Gist の 16 進 hash (20〜40 文字)
 *   - url:  元 Gist URL。fallback リンク先
 */
import { computed, onMounted, ref } from 'vue'
import {
  GIST_EMBED_ORIGIN,
  GIST_ID_PATTERN,
  GIST_USER_PATTERN,
} from '../../constants/zenn-embed'

interface Props {
  /** Gist owner (GitHub ユーザ名)。 */
  user: string
  /** Gist ID (20〜40 文字の小文字 16 進)。 */
  id: string
  /** 元 Gist URL。fallback リンクの href。 */
  url: string
}

const props = defineProps<Props>()

/**
 * 描画先の DOM 参照。`<ClientOnly>` 配下のため SSR 時は null。
 */
const container = ref<HTMLDivElement | null>(null)

/**
 * href として安全な URL か。テンプレート側の深層防御。
 *
 * 絶対 URL かつスキームが `http:` または `https:` のみ true。
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
 * user / id が期待フォーマットであるかを再検証する。
 *
 * remark 側 validator 通過後のみが届く想定だが、template が信頼できない
 * 値で script URL を組み立てないよう、挿入直前にも pattern 検査する。
 */
function isSafeGistIdentifier(user: string, id: string): boolean {
  return GIST_USER_PATTERN.test(user) && GIST_ID_PATTERN.test(id)
}

/**
 * Gist 埋め込み script を container 内に挿入する。
 *
 * 既に同じ script が挿入済み (例: HMR による再実行) の場合は何もしない。
 * 失敗時は何もしないまま fallback (container は空) を保つ。
 */
function injectGistScript(): void {
  if (typeof document === 'undefined') {
    return
  }
  if (!isSafeGistIdentifier(props.user, props.id)) {
    return
  }
  const target = container.value
  if (target === null) {
    return
  }
  // 既に同じ ID の script が挿入済みなら何もしない。
  const existing = target.querySelector(
    `script[data-gist-user="${props.user}"][data-gist-id="${props.id}"]`,
  )
  if (existing !== null) {
    return
  }
  const script = document.createElement('script')
  script.src = `${GIST_EMBED_ORIGIN}/${props.user}/${props.id}.js`
  script.async = true
  // data 属性は本コンポーネント側で重複検知のために使う。Gist 本家が
  // 付与するものではない。
  script.dataset.gistUser = props.user
  script.dataset.gistId = props.id
  target.appendChild(script)
}

onMounted(() => {
  injectGistScript()
})
</script>

<style scoped lang="scss">
.gist-container {
  margin: 1rem 0;

  // Gist が動的に生成する `.gist` ブロックに伸びる余白を抑える。
  :deep(.gist) {
    max-width: 100%;
    overflow-x: auto;
  }
}

.gist-fallback {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 0.4rem;
  background-color: #fff;
  font-size: 0.9rem;

  a {
    color: #0969da;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
