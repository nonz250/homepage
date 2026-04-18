<template>
  <aside :class="['msg', `msg--${resolvedType}`]" :aria-label="ariaLabel">
    <span class="icon" aria-hidden="true">{{ icon }}</span>
    <div class="body">
      <slot />
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * Zenn 独自記法 `:::message` / `:::message alert` に対応する MDC コンポーネント。
 *
 * rehype パイプラインで `<zenn-message>` ブロックに変換された MDC ノードから
 * 呼び出される。props で受け取った type に応じてスタイルとアイコンを切り替え、
 * default slot の本文を枠内にレンダリングする。
 *
 * 既知の type (`info` / `alert`) 以外が渡された場合は `info` にフォールバック
 * し、描画そのものは壊さない (presentational コンポーネントの責務を超えて
 * ビルドを fail させない)。不正な type のガード／警告は rehype プラグイン側
 * (`rehypeAssertNoZennLeftovers` 等) の責務とする。
 */
import { computed } from 'vue'

/**
 * サポートする message type の一覧。
 *
 * Zenn 本家は `info` と `alert` の 2 種類のみを定義している。将来 `warn`
 * 等を追加する場合は、`ZENN_MESSAGE_TYPES` に要素を足してから SCSS と
 * アイコンマップに対応を入れる。
 */
const ZENN_MESSAGE_TYPES = ['info', 'alert'] as const
type ZennMessageType = (typeof ZENN_MESSAGE_TYPES)[number]

/**
 * 未知の type が渡されたときに fallback する既定値。
 */
const DEFAULT_MESSAGE_TYPE: ZennMessageType = 'info'

/**
 * type 別に先頭に表示するプレフィックス絵文字。
 *
 * アイコンライブラリを新規に導入せず、テキスト (emoji) のみで表現する。
 * 視覚的装飾のみでの情報伝達を避けるため、`aria-label` でも type を
 * 伝達する (下記 ariaLabelFor 参照)。
 */
const ICON_BY_TYPE: Readonly<Record<ZennMessageType, string>> = {
  info: 'ℹ️',
  alert: '⚠️',
}

/**
 * type 別のスクリーンリーダー向けラベル。
 *
 * 日本語固定で記事本文と一貫させる。i18n 対応は本 Phase のスコープ外。
 */
const ARIA_LABEL_BY_TYPE: Readonly<Record<ZennMessageType, string>> = {
  info: '情報メッセージ',
  alert: '注意メッセージ',
}

const props = withDefaults(
  defineProps<{
    type?: string
  }>(),
  {
    type: DEFAULT_MESSAGE_TYPE,
  },
)

/**
 * 未知の type が渡された場合は既定値 (`info`) にフォールバックする。
 *
 * `ZENN_MESSAGE_TYPES` に含まれているかで判定することで、将来サポート
 * 種別を増やしたときに単一の配列を更新すれば済む構造にする。
 */
const resolvedType = computed<ZennMessageType>(() => {
  return (ZENN_MESSAGE_TYPES as readonly string[]).includes(props.type)
    ? (props.type as ZennMessageType)
    : DEFAULT_MESSAGE_TYPE
})

const icon = computed<string>(() => ICON_BY_TYPE[resolvedType.value])
const ariaLabel = computed<string>(() => ARIA_LABEL_BY_TYPE[resolvedType.value])
</script>

<style scoped lang="scss">
@use "assets/scss/color";

.msg {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  margin: 1rem 0;
  border-radius: 0.4rem;
  border-left: 4px solid;
  line-height: 1.6;
}

.msg--info {
  background-color: rgba(61, 80, 183, 0.08);
  border-left-color: color.$lab-blue;
  color: color.$black;
}

.msg--alert {
  background-color: rgba(240, 29, 29, 0.08);
  border-left-color: color.$red;
  color: color.$black;
}

.icon {
  flex-shrink: 0;
  font-size: 1.1rem;
  line-height: 1.5;
}

.body {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;

  :deep(p:first-child) {
    margin-top: 0;
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }
}
</style>
