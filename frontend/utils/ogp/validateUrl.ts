/**
 * 外部 URL の SSRF (Server-Side Request Forgery) バリデータ。
 *
 * Phase 3 の OGP 取得処理は、記事内に書かれた任意の外部 URL を generate 時に
 * fetch する。そのままでは内部ネットワーク (10.0.0.0/8 等) や loopback
 * (127.0.0.0/8) を含む任意の宛先へ HTTP 要求が飛ぶリスクがあるため、
 * 取得前に下記 2 段階で検査する。
 *
 *   1. URL 文字列段階の同期チェック (`validateExternalUrl`)
 *      - スキームが `http:` / `https:` か
 *      - ポートが 80 / 443 か (省略時 OK)
 *      - URL 全長が `OGP_URL_MAX_LENGTH` 以下か
 *
 *   2. DNS 解決後の非同期チェック (`resolveAndCheckDns`)
 *      - 解決された全 IP が許可帯域 (= public unicast) か
 *      - DNS リバインディング対策として 2 回 lookup し結果が一致するか
 *
 * IP 帯域チェック (`isIpInRange`) は `dns` 等の I/O を含まない純関数として
 * 実装し、テスト容易性を担保する。
 *
 * 設計選択:
 *   - DNS lookup は DI で差替え可能にし、本番では `dns.promises.lookup` を
 *     fallback として使う。テストでは固定マップを返す関数を渡す。
 *   - `dns.lookup` のキャッシュ汚染や DNS リバインディングを抑止するため、
 *     2 回連続して解決し、IP 集合が完全一致する場合のみ ok を返す。
 *   - 拒否理由は機械可読な `UrlValidationReason` ユニオンで返し、呼び出し側で
 *     ログ出力やテストアサートに使えるようにする。
 */
import {
  OGP_ALLOWED_PORTS,
  OGP_ALLOWED_SCHEMES,
  OGP_URL_MAX_LENGTH,
} from '../../constants/ogp'

/**
 * URL 検査の失敗理由を機械可読な enum 風文字列で表現する。
 *   - `scheme`: スキーム不一致
 *   - `host`: ホスト名が空 / 不正
 *   - `port`: ポートが許可外
 *   - `ip_private`: 私的アドレス帯 (10/8, 172.16/12, 192.168/16, IPv6 ULA)
 *   - `ip_loopback`: 127.0.0.0/8 / ::1
 *   - `ip_link_local`: 169.254/16 / fe80::/10
 *   - `ip_multicast`: 224.0.0.0/4
 *   - `ip_reserved`: 240.0.0.0/4 やその他の予約帯
 *   - `unresolved`: DNS 解決失敗 / リバインディング検出 / 解決結果が空
 *   - `too_long`: URL 文字数が `OGP_URL_MAX_LENGTH` 超過
 */
export type UrlValidationReason =
  | 'scheme'
  | 'host'
  | 'port'
  | 'ip_private'
  | 'ip_loopback'
  | 'ip_link_local'
  | 'ip_multicast'
  | 'ip_reserved'
  | 'unresolved'
  | 'too_long'

/**
 * 検査結果。`ok === true` のときは追加情報なし、`ok === false` のときは
 * `reason` に失敗理由を入れる。`resolvedIps` は DNS 解決を行ったときに
 * デバッグ用途で結果を返す (任意)。
 */
export interface UrlValidationResult {
  readonly ok: boolean
  readonly reason?: UrlValidationReason
  readonly resolvedIps?: readonly string[]
}

/**
 * IPv4 / IPv6 と CIDR プレフィックス長を分けたペア。
 */
interface CidrRange {
  readonly cidr: string
  readonly reason: UrlValidationReason
}

/**
 * 拒否対象 IPv4 帯域。RFC 1918, 5735, 6890 を参考に、grant されている
 * 公開 unicast 以外を網羅的に列挙する。
 */
const BLOCKED_IPV4_RANGES: readonly CidrRange[] = [
  { cidr: '0.0.0.0/8', reason: 'ip_reserved' },          // 「このネットワーク」
  { cidr: '10.0.0.0/8', reason: 'ip_private' },          // RFC1918
  { cidr: '127.0.0.0/8', reason: 'ip_loopback' },        // loopback
  { cidr: '169.254.0.0/16', reason: 'ip_link_local' },   // link-local
  { cidr: '172.16.0.0/12', reason: 'ip_private' },       // RFC1918
  { cidr: '192.168.0.0/16', reason: 'ip_private' },      // RFC1918
  { cidr: '192.0.0.0/24', reason: 'ip_reserved' },       // IETF Protocol Assignments
  { cidr: '198.18.0.0/15', reason: 'ip_reserved' },      // ベンチマーク用
  { cidr: '224.0.0.0/4', reason: 'ip_multicast' },       // multicast
  { cidr: '240.0.0.0/4', reason: 'ip_reserved' },        // 将来用 / 240/4
] as const

/**
 * 拒否対象 IPv6 帯域。
 *   - `::1/128`: loopback
 *   - `fc00::/7`: ULA (RFC4193)
 *   - `fe80::/10`: link-local
 *   - `::ffff:0:0/96`: IPv4-mapped (内部到達手段にされうる)
 */
const BLOCKED_IPV6_RANGES: readonly CidrRange[] = [
  { cidr: '::1/128', reason: 'ip_loopback' },
  { cidr: 'fc00::/7', reason: 'ip_private' },
  { cidr: 'fe80::/10', reason: 'ip_link_local' },
  { cidr: '::ffff:0:0/96', reason: 'ip_reserved' },
] as const

/**
 * IPv4 文字列 (`a.b.c.d`) を 32bit 整数に変換する。各オクテットが 0-255 の
 * 範囲外なら `null` を返す。
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  const expectedOctets = 4
  if (parts.length !== expectedOctets) {
    return null
  }
  const maxOctet = 255
  const bitsPerOctet = 8
  let result = 0
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return null
    }
    if (!/^\d+$/.test(part)) {
      return null
    }
    const value = Number.parseInt(part, 10)
    if (value < 0 || value > maxOctet) {
      return null
    }
    // ビットシフトの代わりに乗算/加算で組み立てる (32bit 符号無し整数として扱うため)
    result = result * (1 << bitsPerOctet) + value
  }
  return result
}

/**
 * IPv6 文字列 (短縮形 `::1` 等含む) を 8 個の 16bit ワード配列に展開する。
 * IPv4-mapped (`::ffff:1.2.3.4` 等) はワード末尾 2 個に変換する。
 * 失敗時は `null`。
 */
function ipv6ToWords(ip: string): readonly number[] | null {
  const ipv6WordCount = 8
  // IPv4-mapped 表記の末尾 IPv4 を 2 word に変換する。
  const ipv4MappedMatch = ip.match(/^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/)
  let normalized = ip
  if (ipv4MappedMatch !== null) {
    const ipv4Int = ipv4ToInt(ipv4MappedMatch[2])
    if (ipv4Int === null) {
      return null
    }
    const upper16Bits = 16
    const upperMask = 0xffff
    const upper = (Math.floor(ipv4Int / (1 << upper16Bits)) & upperMask)
      .toString(16)
    const lower = (ipv4Int & upperMask).toString(16)
    normalized = `${ipv4MappedMatch[1]}${upper}:${lower}`
  }

  // `::` の展開。`::` は連続 0 ワードの省略。
  const doubleColonCount = (normalized.match(/::/g) ?? []).length
  if (doubleColonCount > 1) {
    return null
  }

  let parts: string[]
  if (normalized.includes('::')) {
    const [head, tail] = normalized.split('::')
    const headParts = head === '' ? [] : head.split(':')
    const tailParts = tail === '' ? [] : tail.split(':')
    const missing = ipv6WordCount - headParts.length - tailParts.length
    if (missing < 0) {
      return null
    }
    parts = [...headParts, ...Array<string>(missing).fill('0'), ...tailParts]
  }
  else {
    parts = normalized.split(':')
  }

  if (parts.length !== ipv6WordCount) {
    return null
  }

  const words: number[] = []
  for (const part of parts) {
    if (part.length === 0 || part.length > 4 || !/^[0-9a-fA-F]+$/.test(part)) {
      return null
    }
    words.push(Number.parseInt(part, 16))
  }
  return words
}

/**
 * IPv4 アドレスが指定 CIDR 範囲に含まれるかを判定する純関数。
 * 例: `isIpv4InRange('127.0.0.1', '127.0.0.0/8')` → true
 *
 * `cidr` のフォーマット不正や `ip` のパース失敗時は false を返す
 * (= 「明確に範囲内とは言えない」=「ブロックしない」ではない、上位で別ルールが
 * 拾うことを期待する)。
 */
function isIpv4InRange(ip: string, cidr: string): boolean {
  const [networkStr, prefixStr] = cidr.split('/')
  const ipv4PrefixMax = 32
  const prefix = Number.parseInt(prefixStr, 10)
  if (Number.isNaN(prefix) || prefix < 0 || prefix > ipv4PrefixMax) {
    return false
  }
  const ipInt = ipv4ToInt(ip)
  const netInt = ipv4ToInt(networkStr)
  if (ipInt === null || netInt === null) {
    return false
  }
  if (prefix === 0) {
    return true
  }
  // 上位 prefix bit のみのマスクを作る。乗算で 32bit 内に収める。
  const totalBits = ipv4PrefixMax
  const maskBits = totalBits - prefix
  const divisor = Math.pow(2, maskBits)
  return Math.floor(ipInt / divisor) === Math.floor(netInt / divisor)
}

/**
 * IPv6 アドレスが指定 CIDR 範囲に含まれるか判定する純関数。
 */
function isIpv6InRange(ip: string, cidr: string): boolean {
  const [networkStr, prefixStr] = cidr.split('/')
  const ipv6PrefixMax = 128
  const prefix = Number.parseInt(prefixStr, 10)
  if (Number.isNaN(prefix) || prefix < 0 || prefix > ipv6PrefixMax) {
    return false
  }
  const ipWords = ipv6ToWords(ip)
  const netWords = ipv6ToWords(networkStr)
  if (ipWords === null || netWords === null) {
    return false
  }
  if (prefix === 0) {
    return true
  }
  // 16bit ワード単位で比較する。先頭 fullWords 個は完全一致、
  // 余りビットがあれば最終ワードを部分マスク比較。
  const bitsPerWord = 16
  const fullWords = Math.floor(prefix / bitsPerWord)
  const remainderBits = prefix - fullWords * bitsPerWord
  for (let i = 0; i < fullWords; i += 1) {
    if (ipWords[i] !== netWords[i]) {
      return false
    }
  }
  if (remainderBits === 0) {
    return true
  }
  const wordMaskMax = 0xffff
  const shift = bitsPerWord - remainderBits
  // ビットシフト相当を除算で。
  const divisor = Math.pow(2, shift)
  const ipMasked = Math.floor(ipWords[fullWords] / divisor)
  const netMasked = Math.floor(netWords[fullWords] / divisor)
  // 念のため上位ビットのみを比較するための上限。
  const maskedMax = Math.floor(wordMaskMax / divisor)
  return (ipMasked & maskedMax) === (netMasked & maskedMax)
}

/**
 * IP アドレスが IPv4 か IPv6 かを判定し、対応する CIDR 判定を呼ぶ。
 *
 * テスト容易性のため、`utils/ogp/validateUrl.ts` のメインフロー (DNS 解決) と
 * 切り離したエクスポートとしておく。
 */
export function isIpInRange(ip: string, cidr: string): boolean {
  if (cidr.includes(':')) {
    return isIpv6InRange(ip, cidr)
  }
  return isIpv4InRange(ip, cidr)
}

/**
 * IP が拒否帯域に入っているかを判定し、入っていればその理由を返す。
 * 入っていなければ `null` (= public unicast 想定)。
 */
function findBlockingRange(ip: string): UrlValidationReason | null {
  const isIpv6 = ip.includes(':')
  const ranges = isIpv6 ? BLOCKED_IPV6_RANGES : BLOCKED_IPV4_RANGES
  for (const range of ranges) {
    if (isIpInRange(ip, range.cidr)) {
      return range.reason
    }
  }
  return null
}

/**
 * URL 文字列段階の同期検査。スキーム / ポート / 文字数のみを見る。
 * DNS を引かないため例外の発生がなく、純関数として安全。
 */
export function validateExternalUrl(raw: string): UrlValidationResult {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, reason: 'host' }
  }
  if (raw.length > OGP_URL_MAX_LENGTH) {
    return { ok: false, reason: 'too_long' }
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  }
  catch {
    return { ok: false, reason: 'host' }
  }
  if (!OGP_ALLOWED_SCHEMES.includes(parsed.protocol as typeof OGP_ALLOWED_SCHEMES[number])) {
    return { ok: false, reason: 'scheme' }
  }
  if (parsed.hostname.length === 0) {
    return { ok: false, reason: 'host' }
  }
  // ポート省略時 (= `''`) はスキーム既定 (80/443) として OK 扱い。
  if (parsed.port !== '') {
    const portNum = Number.parseInt(parsed.port, 10)
    if (Number.isNaN(portNum)) {
      return { ok: false, reason: 'port' }
    }
    if (!OGP_ALLOWED_PORTS.includes(portNum as typeof OGP_ALLOWED_PORTS[number])) {
      return { ok: false, reason: 'port' }
    }
  }
  return { ok: true }
}

/**
 * デフォルトの DNS lookup 関数。本番では `dns.promises.lookup` を all=true で
 * 呼び、解決された全 IP を返す。
 *
 * テスト時は呼ばれないよう `resolveAndCheckDns` の第 2 引数で差替えること。
 */
async function defaultLookup(host: string): Promise<readonly string[]> {
  const dns = await import('node:dns')
  const all = await dns.promises.lookup(host, { all: true })
  return all.map(addr => addr.address)
}

/**
 * 同じ IP 集合 (順不同) かを判定する。文字列の sort 比較で十分 (IPv4/IPv6 を
 * 含む全ホスト名が一致するかを見るため、表現を一意化する役割)。
 */
function sameIpSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  for (let i = 0; i < sortedA.length; i += 1) {
    if (sortedA[i] !== sortedB[i]) {
      return false
    }
  }
  return true
}

/**
 * DNS 解決を 2 回行い、解決結果が完全一致 (リバインディングなし) かつ
 * 全 IP が許可帯域に含まれるかを検査する。
 *
 * @param host チェック対象のホスト名 (URL ではなく `parsed.hostname`)
 * @param lookup DI 用差替え関数。省略時は `dns.promises.lookup` を使う
 */
export async function resolveAndCheckDns(
  host: string,
  lookup?: (host: string) => Promise<readonly string[]>,
): Promise<UrlValidationResult> {
  const lookupFn = lookup ?? defaultLookup
  let firstIps: readonly string[]
  let secondIps: readonly string[]
  try {
    firstIps = await lookupFn(host)
    secondIps = await lookupFn(host)
  }
  catch {
    return { ok: false, reason: 'unresolved' }
  }
  if (firstIps.length === 0 || secondIps.length === 0) {
    return { ok: false, reason: 'unresolved' }
  }
  if (!sameIpSet(firstIps, secondIps)) {
    return { ok: false, reason: 'unresolved', resolvedIps: firstIps }
  }
  for (const ip of firstIps) {
    const blockedReason = findBlockingRange(ip)
    if (blockedReason !== null) {
      return { ok: false, reason: blockedReason, resolvedIps: firstIps }
    }
  }
  return { ok: true, resolvedIps: firstIps }
}
