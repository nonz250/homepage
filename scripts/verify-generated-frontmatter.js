#!/usr/bin/env node
/**
 * verify-generated-frontmatter.js
 *
 * 生成物 (articles/**\/*.md と public/**\/*.md) の frontmatter を、
 * scripts/lib/yaml-safe-parse.ts の `safeParseFrontmatterBlock` で独立 parse
 * し、以下を検証する。
 *
 *   - articles/*.md:
 *       * "published" が "true" または "false" 文字列であること (FAILSAFE parse)
 *       * "published_at" が 3 形式のいずれかに match すること (regex)
 *   - public/*.md:
 *       * "ignorePublish" が "true" であること (qiita 限定共有状態)
 *       * "private" が "true" または "false" 文字列であること
 *
 * 1 ファイルでも違反があれば process.exit(1) で CI を fail させる。
 *
 * 実行: node scripts/verify-generated-frontmatter.js
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

// published_at の 3 形式 (constants.ts と同期、shell/node 境界のため複製)。
const PUBLISHED_AT_PATTERNS = [
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d$/,
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d[+-]([01]\d|2[0-3]):[0-5]\d$/,
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/,
]

const FRONTMATTER_DELIMITER = '---'

/**
 * ファイル文字列から frontmatter ブロックを切り出す。
 */
function extractFrontmatterBlock(content) {
  const lines = content.split('\n')
  if (lines.length === 0 || lines[0] !== FRONTMATTER_DELIMITER) {
    throw new Error('file does not start with frontmatter delimiter')
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === FRONTMATTER_DELIMITER) {
      return lines.slice(1, i).join('\n') + '\n'
    }
  }
  throw new Error('frontmatter terminator not found')
}

/**
 * js-yaml FAILSAFE で 1 ファイル parse し、SafeFrontmatter を返す。
 */
function safeParse(fmText) {
  const loaded = yaml.load(fmText, { schema: yaml.FAILSAFE_SCHEMA })
  if (loaded === null || loaded === undefined) {
    return {}
  }
  if (typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new Error('frontmatter top-level is not a mapping')
  }
  return loaded
}

/**
 * ディレクトリ直下 (1 階層) の .md を列挙する。
 */
function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return []
  const names = fs.readdirSync(dir)
  const results = []
  for (const name of names) {
    if (name.startsWith('.')) continue
    if (!name.endsWith('.md')) continue
    const full = path.join(dir, name)
    const stats = fs.statSync(full)
    if (stats.isFile()) {
      results.push(full)
    }
  }
  return results.sort()
}

/**
 * articles/*.md の検証。
 */
function verifyZennArticle(filePath, fm, failures) {
  if (fm.published !== 'true' && fm.published !== 'false') {
    failures.push(
      `${filePath}: "published" must be "true"/"false" (got ${JSON.stringify(fm.published)})`,
    )
  }
  if (typeof fm.published_at !== 'string') {
    failures.push(
      `${filePath}: "published_at" must be a string (got ${typeof fm.published_at})`,
    )
    return
  }
  const matched = PUBLISHED_AT_PATTERNS.some((p) => p.test(fm.published_at))
  if (!matched) {
    failures.push(
      `${filePath}: "published_at" does not match any accepted format (got ${JSON.stringify(fm.published_at)})`,
    )
  }
}

/**
 * public/*.md の検証。
 */
function verifyQiitaArticle(filePath, fm, failures) {
  if (fm.ignorePublish !== 'true') {
    failures.push(
      `${filePath}: "ignorePublish" must be "true" (got ${JSON.stringify(fm.ignorePublish)})`,
    )
  }
  if (fm.private !== 'true' && fm.private !== 'false') {
    failures.push(
      `${filePath}: "private" must be "true"/"false" (got ${JSON.stringify(fm.private)})`,
    )
  }
}

function main() {
  const repoRoot = process.cwd()
  const articlesDir = path.join(repoRoot, 'articles')
  const publicDir = path.join(repoRoot, 'public')
  const failures = []

  for (const filePath of listMarkdown(articlesDir)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const fmText = extractFrontmatterBlock(content)
      const fm = safeParse(fmText)
      verifyZennArticle(filePath, fm, failures)
    } catch (error) {
      failures.push(`${filePath}: ${error.message}`)
    }
  }

  for (const filePath of listMarkdown(publicDir)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const fmText = extractFrontmatterBlock(content)
      const fm = safeParse(fmText)
      verifyQiitaArticle(filePath, fm, failures)
    } catch (error) {
      failures.push(`${filePath}: ${error.message}`)
    }
  }

  if (failures.length > 0) {
    process.stderr.write(
      `verify-generated-frontmatter: ${failures.length} violation(s) found:\n`,
    )
    for (const line of failures) {
      process.stderr.write(`  - ${line}\n`)
    }
    process.exit(1)
  }
  console.log('OK: all generated frontmatter passes independent parse')
}

main()
