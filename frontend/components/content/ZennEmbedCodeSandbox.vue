<template>
  <div v-if="isValid" class="embed embed--codesandbox">
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
 * Zenn 独自記法 `@[codesandbox](sandbox-id)` に対応する MDC コンポーネント。
 *
 * 受け取った `id` prop は素の sandbox ID (英数字 / `_` / `-` の最大 40 文字)
 * を想定する。`validateCodeSandboxId` を通過したもののみ iframe を描画し、
 * src は `${origin}/embed/${id}` 形式で組み立てる。`s/<id>` の共有 URL 形式
 * については validator が通しつつ id がそのまま渡るため、本 Phase では
 * 呼び出し側 (rehype プラグイン) で素の id に正規化済みであることを前提とする。
 */
import { computed } from 'vue'
import {
  CODESANDBOX_EMBED_ORIGIN,
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
} from '~/constants/zenn-embed'
import { getIframePolicy } from '~/config/iframe-allowlist'
import { validateCodeSandboxId } from '~/utils/markdown/validateEmbedId'

/**
 * CodeSandbox iframe の埋め込みパス接頭辞。
 */
const CODESANDBOX_EMBED_PATH_PREFIX = '/embed/'

/**
 * a11y 用の iframe title 接頭辞。
 */
const IFRAME_TITLE_PREFIX = 'CodeSandbox embed'

const props = defineProps<{
  id: string
}>()

const isValid = computed<boolean>(() => validateCodeSandboxId(props.id).valid)

const policy = getIframePolicy('codesandbox')

const src = computed<string>(
  () =>
    `${CODESANDBOX_EMBED_ORIGIN}${CODESANDBOX_EMBED_PATH_PREFIX}${props.id}`,
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

.embed--codesandbox {
  aspect-ratio: 16 / 9;
  background-color: #151515;
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
