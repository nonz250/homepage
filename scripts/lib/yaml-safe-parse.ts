import yaml from 'js-yaml'

/**
 * 独立 re-parse assert の実装。
 *
 * gray-matter は内部で js-yaml を使っているが、本モジュールでは **別インスタンス**
 * の js-yaml を FAILSAFE_SCHEMA で呼び出す。これにより:
 *
 *   1. gray-matter が解釈を間違えていないかを独立検証できる
 *   2. FAILSAFE_SCHEMA は `!!str` / `!!seq` / `!!map` のみ許容 (bool/int/timestamp
 *      すら文字列として読む) のため、`!!js/function` のような危険タグを
 *      確実に reject できる
 *   3. gray-matter が切り出した frontmatter と実ファイル内容の整合性を
 *      書き込み直後に検証できる (fail-closed)
 *
 * 本モジュールは I/O を持たない純関数の集合。ファイル読み書きは io/ 配下に
 * 分離する。
 */

/**
 * FAILSAFE_SCHEMA で parse した結果を、"string または string[]" 限定の
 * レコードとして型付けする。数値・真偽値もすべて文字列として返る点に注意。
 */
export type SafeFrontmatter = Record<
  string,
  string | readonly string[] | undefined
>

/**
 * 与えられた YAML 文字列を js-yaml FAILSAFE_SCHEMA で parse する純関数。
 *
 * 戻り値は string / string[] / undefined のレコード。bool / number 等は
 * FAILSAFE の仕様上すべて文字列化される。
 *
 * @throws YAML シンタックスエラーや危険タグ検出時。
 */
export function safeParseFrontmatterBlock(yamlText: string): SafeFrontmatter {
  const loaded = yaml.load(yamlText, {
    schema: yaml.FAILSAFE_SCHEMA,
    // デフォルトで filename が未定義だと警告を出さないため、明示的に指定。
    filename: '<frontmatter-block>',
  })
  if (loaded === null || loaded === undefined) {
    return {}
  }
  if (typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new Error(
      '[yaml-safe-parse] expected a mapping at the top level of the frontmatter',
    )
  }
  const record = loaded as Record<string, unknown>
  const normalized: Record<string, string | readonly string[] | undefined> = {}
  for (const [key, value] of Object.entries(record)) {
    normalized[key] = normalizeValue(value, key)
  }
  return normalized
}

/**
 * FAILSAFE で parse された値を string / string[] / undefined に正規化する。
 *
 * FAILSAFE 下では全てのスカラーは string で返るため、想定外の型 (Buffer
 * / Date / number 等) が現れた場合は throw する。
 */
function normalizeValue(
  value: unknown,
  key: string,
): string | readonly string[] | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    const items: string[] = []
    for (const item of value) {
      if (typeof item !== 'string') {
        throw new Error(
          `[yaml-safe-parse] non-string array item for key "${key}"`,
        )
      }
      items.push(item)
    }
    return items
  }
  throw new Error(
    `[yaml-safe-parse] unsupported value type for key "${key}": ${typeof value}`,
  )
}

/**
 * frontmatter のデリミタ (`---`) と改行。
 */
const FRONTMATTER_DELIMITER = '---'

/**
 * ファイル全体の文字列から frontmatter ブロック (--- で挟まれた部分) を
 * 切り出す純関数。
 *
 * @throws frontmatter の開始・終了デリミタが検出できない場合。
 */
function extractFrontmatterBlock(fileContent: string): string {
  const lines = fileContent.split('\n')
  if (lines.length === 0 || lines[0] !== FRONTMATTER_DELIMITER) {
    throw new Error(
      '[yaml-safe-parse] file does not start with frontmatter delimiter "---"',
    )
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === FRONTMATTER_DELIMITER) {
      return lines.slice(1, i).join('\n') + '\n'
    }
  }
  throw new Error(
    '[yaml-safe-parse] frontmatter terminator "---" was not found',
  )
}

/**
 * 書き込み後のファイル内容に対する独立検証。
 *
 * expectedKeys の各 key について、独立 re-parse の結果と **文字列一致** で
 * 比較する。差異があれば throw。スカラーだけでなく string[] (topics の
 * ブロック/フロー問わず) も同一値チェックを行う。
 *
 * FAILSAFE_SCHEMA の性質上、元の YAML で `true` / `false` と書かれていても
 * `"true"` / `"false"` として parse されるため、expectedKeys 側も文字列で
 * 与える。
 */
export function assertWriteIntegrity(
  fileContent: string,
  expectedKeys: Record<string, string | readonly string[]>,
): void {
  const block = extractFrontmatterBlock(fileContent)
  const parsed = safeParseFrontmatterBlock(block)
  const failures: string[] = []
  for (const [key, expected] of Object.entries(expectedKeys)) {
    const actual = parsed[key]
    if (actual === undefined) {
      failures.push(`missing key "${key}"`)
      continue
    }
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        failures.push(`expected array for key "${key}", got "${typeof actual}"`)
        continue
      }
      if (!arraysEqual(actual, expected)) {
        failures.push(
          `array mismatch for key "${key}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        )
      }
      continue
    }
    if (typeof actual !== 'string') {
      failures.push(`expected string for key "${key}", got "${typeof actual}"`)
      continue
    }
    if (actual !== expected) {
      failures.push(
        `value mismatch for key "${key}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      )
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `[assertWriteIntegrity] frontmatter mismatch:\n${failures
        .map((f) => `  - ${f}`)
        .join('\n')}`,
    )
  }
}

/**
 * 順序と値を保ったまま 2 つの文字列配列が等しいかを判定する純関数。
 */
function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}
