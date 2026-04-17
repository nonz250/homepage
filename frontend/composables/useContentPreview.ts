import { useRuntimeConfig } from '#imports'

/**
 * コンテンツプレビュー表示が有効かどうかを取得する composable。
 *
 * 実体は `runtimeConfig.contentPreview` を返すだけのシンプルなラッパー。
 * コンポーネント側が `useRuntimeConfig()` の形状に直接依存しないよう、
 * UI と設定値の間に間接層を設ける。本番ビルドでは常に `false` になる
 * (値の算出は `nuxt.config.ts` 側で閉じ込める)。
 */
export function useContentPreview(): boolean {
  return useRuntimeConfig().contentPreview
}
