/**
 * Noto Sans JP のサブセット化スクリプト (Satori OGP 画像用)。
 *
 * 目的:
 *   Noto Sans JP (Japanese subset) は ~1.9MB あり、Satori でテキスト描画する
 *   たびに巨大なグリフ配列を舐めるため重い。OGP 画像で実際に使う文字は限ら
 *   れる (記事タイトル + サイト名 + 日付 + 数字 + 英字 + 記号) ため、
 *   harfbuzz ベースの subset-font で必要グリフだけ抽出して < 200KB に縮める。
 *
 * 実行:
 *   node scripts/subset-noto-sans-jp.mjs
 *
 * 出力:
 *   public/fonts/noto-sans-jp-subset.woff
 *
 * 運用:
 *   Batch B では生成物を git 管理下に置き、記事追加のたびの再実行は行わない。
 *   将来の新記事タイトル文字が追従されない問題が出たら後続フェーズで自動化。
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, parse as parsePath, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import subsetFont from 'subset-font'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** フロントエンドディレクトリの絶対パス */
const FRONTEND_DIR = resolve(__dirname, '..')

/** リポジトリ root */
const REPO_ROOT = resolve(FRONTEND_DIR, '..')

/**
 * 記事ディレクトリ (タイトル文字収集用) (v4)。
 *
 * v4 では原典が site-articles/ に一本化されたため、この 1 箇所だけを走査する。
 * articles/ は generator の出力 (site-articles/ の部分集合) なので、同一の
 * タイトル文字しか含まれない → 走査不要。
 */
const ARTICLE_DIRS = [resolve(REPO_ROOT, 'site-articles')]

/** ソースフォント (WOFF。Satori が WOFF2 を受け付けないため WOFF 版を採用) */
const SOURCE_FONT = resolve(
  FRONTEND_DIR,
  'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff',
)

/** 出力先ディレクトリ */
const OUTPUT_DIR = resolve(FRONTEND_DIR, 'public/fonts')

/** 出力ファイル名 */
const OUTPUT_FILE = 'noto-sans-jp-subset.woff'

/**
 * 固定で含める文字集合。
 *
 * - 基本英数字: a-z A-Z 0-9
 * - サイト名の日本語: Nozomi Hosaka はアルファベットだけで足りるが、将来の
 *   日付表記 (例: 「2026年4月」) に備え、頻出漢字と記号を含める
 * - 日付関連: 年月日 / ハイフン / スラッシュ / コロン / 時分
 * - 記号類: #, @, /, .,  ! ? : ( ) [ ] 「」『』、。・
 */
const FIXED_CHARACTERS =
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '0123456789' +
  '年月日時分秒' +
  '#@/.,!?:;-_()[]<>' +
  '「」『』、。・ー' +
  ' '

/** サイト名 */
const SITE_TITLE_TEXT = 'Nozomi Hosaka'

/**
 * 指定ディレクトリ配下の Markdown から `title` frontmatter を集める。
 */
function collectArticleTitles(dirs) {
  const titles = []
  for (const dir of dirs) {
    if (!safeIsDirectory(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.md')) continue
      const abs = join(dir, entry.name)
      const raw = readFileSync(abs, 'utf8')
      const { data } = matter(raw)
      if (typeof data.title === 'string') titles.push(data.title)
    }
  }
  return titles
}

function safeIsDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * 与えられた文字列配列を結合し、重複なしの「使用文字の集合」を返す。
 *
 * Array.from(new Set(...)).join('') で十分だが、サロゲートペア (絵文字)
 * はそのまま含めず、単純な BMP + 各コードポイントの集合にする。
 */
function buildCharacterSet(strings) {
  const set = new Set()
  for (const s of strings) {
    for (const ch of s) {
      set.add(ch)
    }
  }
  return Array.from(set).join('')
}

async function main() {
  console.log('[subset] reading source font:', SOURCE_FONT)
  const sourceBuffer = readFileSync(SOURCE_FONT)
  console.log(`[subset] source size: ${sourceBuffer.length.toLocaleString()} bytes`)

  const titles = collectArticleTitles(ARTICLE_DIRS)
  console.log(`[subset] collected ${titles.length} article titles`)

  const inputText = buildCharacterSet([
    ...titles,
    SITE_TITLE_TEXT,
    FIXED_CHARACTERS,
  ])
  console.log(`[subset] unique characters: ${Array.from(inputText).length}`)

  const subsetBuffer = await subsetFont(sourceBuffer, inputText, {
    targetFormat: 'woff',
  })
  console.log(`[subset] subset size: ${subsetBuffer.length.toLocaleString()} bytes`)

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  const outPath = join(OUTPUT_DIR, OUTPUT_FILE)
  writeFileSync(outPath, subsetBuffer)
  console.log('[subset] wrote:', outPath)
}

main().catch((err) => {
  console.error('[subset] failed:', err)
  process.exit(1)
})
