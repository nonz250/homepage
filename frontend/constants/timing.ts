/**
 * タイミング系マジックナンバーを集約した定数モジュール。
 *
 * UI アニメーション・スクロール監視・再描画スケジューリングなどで利用する
 * 時間（ミリ秒）や閾値（ピクセル）、サンプリングレート（FPS）を定義する。
 */

/** ヘッダの「上部に居るか」判定に使う scrollY の閾値（px） */
export const HEADER_SHRINK_THRESHOLD_PX = 5

/** スクロール状態を評価するサンプリングレート（frames per second） */
export const HEADER_SCROLL_CHECK_FPS = 60

/** 1秒をミリ秒に変換する際の基準値 */
export const MILLISECONDS_PER_SECOND = 1000

/** Anchor コンポーネントの shine アニメーション再起動間隔（ms） */
export const ANCHOR_ACTIVATION_INTERVAL_MS = 3000

/** Anchor の active 状態を自動解除するまでの持続時間（ms） */
export const ANCHOR_SHINE_ACTIVE_DURATION_MS = 500

/** プロフィールメッセージの下線描画を開始するまでの初回遅延（ms） */
export const UNDERLINE_DRAW_INITIAL_DELAY_MS = 1000

/** 下線描画を次の行に進めるまでのステップ遅延（ms） */
export const UNDERLINE_DRAW_STEP_DELAY_MS = 2000

/** 下線描画サイクル全体を再実行する周期（ms） */
export const UNDERLINE_REDRAW_INTERVAL_MS = 15000

/** contact セクションのアクティブ状態を再評価する周期（ms） */
export const CONTACT_ACTIVE_CHECK_INTERVAL_MS = 1500
