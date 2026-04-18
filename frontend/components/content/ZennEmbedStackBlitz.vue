<template>
  <div v-if="isValid" class="embed embed--stackblitz">
    <iframe
      class="frame"
      :src="src"
      :sandbox="policy.sandbox"
      :allow="policy.allow"
      :title="iframeTitle"
      :loading="loadingStrategy"
      :referrerpolicy="referrerPolicy"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Zenn 独自記法 `@[stackblitz](edit/xxx)` 等に対応する MDC コンポーネント。
 *
 * 受け取る `id` prop は `edit/<project>` または `github/<owner>/<repo>` の
 * パス形式を想定する (`validateStackBlitzPath` で検査)。src は
 * `${origin}/${id}?embed=1` で、StackBlitz 公式の埋め込みクエリを付与する。
 */
import { computed } from 'vue'
import {
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
  STACKBLITZ_EMBED_ORIGIN,
} from '~/constants/zenn-embed'
import { getIframePolicy } from '~/config/iframe-allowlist'
import { validateStackBlitzPath } from '~/utils/markdown/validateEmbedId'

/**
 * StackBlitz の埋め込み有効化クエリ。
 *
 * 公式仕様で `?embed=1` を付与すると埋め込みモードになる。ここをハード
 * コードせず named constant 化し、将来クエリを追加する際の拡張性を確保する。
 */
const STACKBLITZ_EMBED_QUERY = '?embed=1'

/**
 * a11y 用の iframe title 接頭辞。
 */
const IFRAME_TITLE_PREFIX = 'StackBlitz embed'

const props = defineProps<{
  id: string
}>()

const isValid = computed<boolean>(() => validateStackBlitzPath(props.id).valid)

const policy = getIframePolicy('stackblitz')

const src = computed<string>(
  () => `${STACKBLITZ_EMBED_ORIGIN}/${props.id}${STACKBLITZ_EMBED_QUERY}`,
)

const iframeTitle = computed<string>(() => `${IFRAME_TITLE_PREFIX} ${props.id}`)

const loadingStrategy = IFRAME_LOADING_LAZY
const referrerPolicy = IFRAME_REFERRER_POLICY
</script>

<style scoped lang="scss">
.embed {
  margin: 1.25rem 0;
  width: 100%;
}

.embed--stackblitz {
  aspect-ratio: 16 / 9;
  background-color: #1b1b1b;
  border-radius: 0.4rem;
  overflow: hidden;
}

.frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
