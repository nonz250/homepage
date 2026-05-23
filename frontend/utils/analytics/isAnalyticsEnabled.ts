/**
 * GTM コンテナ ID (`GTM-XXXXXX`) のフォーマットを検証する純関数。
 *
 * GTM の container ID は `GTM-` プレフィクスのあとに英大文字+数字 6〜10 桁
 * (慣例) なので、境界を緩めに `[A-Z0-9]{6,}` とする。形式不正な値が
 * `runtimeConfig.public.gtmId` に入ったときは `<script>` 読み込み自体を
 * スキップして fail-closed させるための tripwire。
 */
export const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{6,}$/

export function isValidGtmContainerId(id: string | undefined | null): boolean {
  // GitHub Actions secret の末尾改行や手コピーで紛れ込む前後空白を吸収する。
  // 吸収しないと「見た目は正しいのに enabled にならない」事故が起きる。
  const trimmed = id?.trim()
  if (!trimmed) {
    return false
  }
  return GTM_CONTAINER_ID_PATTERN.test(trimmed)
}

export type AnalyticsGateInput = {
  readonly nodeEnv: string | undefined
  readonly gtmId: string | undefined | null
}

export function isAnalyticsEnabled(input: AnalyticsGateInput): boolean {
  return input.nodeEnv === 'production' && isValidGtmContainerId(input.gtmId)
}
