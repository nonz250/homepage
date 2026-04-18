/**
 * `/tags.json` を配信する Nitro server handler。
 *
 * ビルド時 (`nitro:config` hook) で構築した `tagsIndexJson` を runtimeConfig
 * 経由で受け取り、そのまま `application/json` として返す。prerender 対象
 * (`nitro.prerender.routes` に `/tags.json` を追加済み) に含まれているため、
 * generate 後は `.output/public/tags.json` が emit され、以降は静的ファイルと
 * して配信される。
 *
 * composable `useTagIndex` は `$fetch('/tags.json')` でこのパスを取りに来る。
 * prerender 時 / runtime 時 / クライアントのブラウザ経路 いずれでも同じ URL
 * で取れるため、呼び出し側は環境差を意識しなくて良い。
 *
 * fail-safe:
 *   runtimeConfig に `tagsIndexJson` が未定義の場合は空オブジェクトを返す
 *   (空タグ index 相当)。`nitro:config` では必ず空オブジェクトでも JSON.stringify
 *   しているはずだが、設定ミスで落ちた時にも handler が 500 を返さないように
 *   保険で `{}` にフォールバックする。
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

/** JSON 応答の Content-Type */
const CONTENT_TYPE_JSON = 'application/json; charset=utf-8'

/** runtimeConfig に tagsIndexJson が未設定だった場合のフォールバック */
const EMPTY_TAGS_INDEX_JSON = '{}'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event) as { tagsIndexJson?: string }
  const body =
    typeof config.tagsIndexJson === 'string'
      ? config.tagsIndexJson
      : EMPTY_TAGS_INDEX_JSON
  setResponseHeader(event, 'content-type', CONTENT_TYPE_JSON)
  return body
})
