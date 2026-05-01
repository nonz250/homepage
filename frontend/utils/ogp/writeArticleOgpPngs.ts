/**
 * 公開対象の記事 OGP PNG を並列生成し、publicDir 配下に書き出すビルド時
 * ユーティリティ。
 *
 * `nitro:build:public-assets` hook から呼ぶ想定で、I/O を含むため純関数には
 * 出来ない。ただし Satori/resvg の生成自体は `generateArticleOgp` に閉じ込め、
 * ここでは「並列実行 + ファイル書き込み」という単一責任に絞る。
 *
 * 並列度:
 *   Satori + resvg は CPU bound のため、プロセスのコア数を超える並列度を
 *   かけても速くならない。記事数が数十〜百程度を想定し、固定値 4 を上限に
 *   する (設計 v4 Batch B)。
 *
 * 失敗:
 *   1 記事の失敗は build を止める。public-assets hook で throw すれば build
 *   自体が fail するため、fail-closed を維持できる。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateArticleOgp } from './generateArticleOgp'
import type { OgpInputEntry } from './buildOgpInputs'

/** 同時生成の上限 (CPU bound なので小さく保つ) */
export const MAX_OGP_CONCURRENCY = 4

/**
 * `writeArticleOgpPngs` のオプション。
 */
export interface WriteArticleOgpPngsOpts {
  /** 出力先ディレクトリ (例: `.output/public/ogp`) */
  readonly outputDir: string
  /** Satori に渡すフォントバッファ */
  readonly fontBuffer: Buffer
  /** 並列度。未指定なら MAX_OGP_CONCURRENCY。テスト用に明示注入可能にする */
  readonly concurrency?: number
  /**
   * ログ出力先。CI で進捗を出したい場合は console.log 相当を渡す。
   * 未指定なら黙る (テスト時の副作用抑止)。
   */
  readonly logger?: (message: string) => void
  /**
   * footer 右端に焼き込むロゴ画像の data URI。
   * 各 entry の `generateArticleOgp` 呼び出しに同値で伝搬する。
   * 未指定ならロゴなし (既存挙動)。
   */
  readonly logoDataUri?: string
}

/**
 * 各エントリに対して並列に OGP PNG を生成し、`<outputDir>/<slug>.png` に書き出す。
 *
 * @returns 書き出したファイルパスの配列 (生成順ではなく entry 順)
 */
export async function writeArticleOgpPngs(
  entries: readonly OgpInputEntry[],
  opts: WriteArticleOgpPngsOpts,
): Promise<string[]> {
  const concurrency = opts.concurrency ?? MAX_OGP_CONCURRENCY
  mkdirSync(opts.outputDir, { recursive: true })

  const written: string[] = new Array(entries.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++
      if (idx >= entries.length) break
      const entry = entries[idx]
      const png = await generateArticleOgp(entry.input, {
        fontBuffer: opts.fontBuffer,
        logoDataUri: opts.logoDataUri,
      })
      const outPath = join(opts.outputDir, `${entry.slug}.png`)
      writeFileSync(outPath, png)
      written[idx] = outPath
      opts.logger?.(`[ogp] wrote ${outPath} (${png.length} bytes)`)
    }
  }

  const workers: Promise<void>[] = []
  const workerCount = Math.max(1, Math.min(concurrency, entries.length))
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)
  return written
}
