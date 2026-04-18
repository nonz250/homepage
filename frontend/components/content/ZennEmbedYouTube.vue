<template>
  <div v-if="isValid" class="embed embed--youtube">
    <iframe
      class="frame"
      :src="src"
      :sandbox="policy.sandbox"
      :allow="policy.allow"
      :title="iframeTitle"
      :loading="loadingStrategy"
      :referrerpolicy="referrerPolicy"
      allowfullscreen
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Zenn 独自記法 `@[youtube](videoId)` に対応する MDC コンポーネント。
 *
 * YouTube の video ID を受け取り、`youtube-nocookie.com` の埋め込み URL を
 * 構築して 16:9 の iframe として描画する。事前に `validateYouTubeVideoId`
 * で ID を検査し、不正であれば何も描画しない (defense in depth)。本来
 * rehype パイプライン側でも検証するが、テンプレート側でも二重に守ることで
 * 不正 ID 経由の任意 src を確実に塞ぐ。
 *
 * iframe の sandbox / allow / origin は `config/iframe-allowlist.ts` を
 * 単一ソースとして参照し、CSP とも整合させる。
 */
import { computed } from 'vue'
import {
  IFRAME_LOADING_LAZY,
  IFRAME_REFERRER_POLICY,
  YOUTUBE_EMBED_ORIGIN,
} from '~/constants/zenn-embed'
import { getIframePolicy } from '~/config/iframe-allowlist'
import { validateYouTubeVideoId } from '~/utils/markdown/validateEmbedId'

/**
 * YouTube iframe の埋め込みパス接頭辞。
 *
 * `${origin}/embed/${id}` の形式で Video ID を埋め込む。この定数を直書き
 * せず切り出しておくことで、将来 `/embed/videoseries` など別パスへの対応
 * が必要になったときの影響範囲を限定する。
 */
const YOUTUBE_EMBED_PATH_PREFIX = '/embed/'

/**
 * a11y 用の iframe title 接頭辞。i18n 対応は本 Phase のスコープ外。
 */
const IFRAME_TITLE_PREFIX = 'YouTube video'

const props = defineProps<{
  id: string
}>()

/**
 * 受け取った ID が YouTube 仕様 (11 文字の英数字 / `_` / `-`) を満たすか。
 * ここで false になったら iframe は描画しない。
 */
const isValid = computed<boolean>(() => validateYouTubeVideoId(props.id).valid)

/**
 * YouTube 向けの iframe ポリシー。origin / sandbox / allow を含む。
 */
const policy = getIframePolicy('youtube')

const src = computed<string>(
  () => `${YOUTUBE_EMBED_ORIGIN}${YOUTUBE_EMBED_PATH_PREFIX}${props.id}`,
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

.embed--youtube {
  aspect-ratio: 16 / 9;
  background-color: #000;
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
