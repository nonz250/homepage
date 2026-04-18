<template>
  <div v-if="isValid" class="embed embed--codepen">
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
 * Zenn 独自記法 `@[codepen](https://codepen.io/user/pen/hash)` に対応する
 * MDC コンポーネント。
 *
 * 受け取った `id` prop は `user/pen/hash` または `user/embed/hash` の
 * パス形式で、`validateCodePenPath` を通過したもののみ iframe を描画する。
 * src は `${origin}/${id}` で組み立て、sandbox/allow は iframe-allowlist の
 * `codepen` ポリシーを参照する。
 */
import { computed } from 'vue'
import {
  CODEPEN_EMBED_ORIGIN,
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
} from '~/constants/zenn-embed'
import { getIframePolicy } from '~/config/iframe-allowlist'
import { validateCodePenPath } from '~/utils/markdown/validateEmbedId'

/**
 * a11y 用の iframe title 接頭辞。i18n 対応は本 Phase のスコープ外。
 */
const IFRAME_TITLE_PREFIX = 'CodePen embed'

const props = defineProps<{
  id: string
}>()

const isValid = computed<boolean>(() => validateCodePenPath(props.id).valid)

const policy = getIframePolicy('codepen')

const src = computed<string>(() => `${CODEPEN_EMBED_ORIGIN}/${props.id}`)

const iframeTitle = computed<string>(() => `${IFRAME_TITLE_PREFIX} ${props.id}`)

const loadingStrategy = IFRAME_LOADING_LAZY
const referrerPolicy = IFRAME_REFERRER_POLICY
</script>

<style scoped lang="scss">
.embed {
  margin: 1.25rem 0;
  width: 100%;
}

.embed--codepen {
  aspect-ratio: 4 / 3;
  background-color: #f5f5f5;
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
