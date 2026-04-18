/**
 * `utils/ogp/validateUrl.ts` のユニットテスト。
 *
 * カバー範囲:
 *   - URL 文字列段階の検査 `validateExternalUrl`
 *     - スキーム / ポート / URL 長 / ホスト空 / 不正 URL の各分岐
 *   - 純関数 `isIpInRange`
 *     - IPv4 と IPv6 双方の代表帯域
 *   - DNS 段階の `resolveAndCheckDns`
 *     - public IP で OK
 *     - private IP で `ip_private`
 *     - lookup 失敗 / 空応答で `unresolved`
 *     - 2 回目の lookup で別 IP が返る場合 (DNS リバインディング) で `unresolved`
 *
 * 設計上の考慮: 本番実装では `dns.promises.lookup` を呼ぶが、テストでは
 * 純粋に決定的な fake lookup を渡してネットワークを使わない。
 */
import { describe, expect, it } from 'vitest'
import {
  isIpInRange,
  resolveAndCheckDns,
  validateExternalUrl,
} from '../../../utils/ogp/validateUrl'
import { OGP_URL_MAX_LENGTH } from '../../../constants/ogp'

describe('validateExternalUrl', () => {
  describe('scheme', () => {
    it('accepts http URL', () => {
      const result = validateExternalUrl('http://example.com/path')
      expect(result.ok).toBe(true)
    })

    it('accepts https URL', () => {
      const result = validateExternalUrl('https://example.com/path')
      expect(result.ok).toBe(true)
    })

    it('rejects file URL with reason scheme', () => {
      const result = validateExternalUrl('file:///etc/passwd')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('scheme')
    })

    it('rejects gopher URL', () => {
      const result = validateExternalUrl('gopher://example.com/0/somefile')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('scheme')
    })

    it('rejects data URL', () => {
      const result = validateExternalUrl('data:text/html,<script>alert(1)</script>')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('scheme')
    })
  })

  describe('port', () => {
    it('accepts URL with port 80', () => {
      const result = validateExternalUrl('http://example.com:80/')
      expect(result.ok).toBe(true)
    })

    it('accepts URL with port 443', () => {
      const result = validateExternalUrl('https://example.com:443/')
      expect(result.ok).toBe(true)
    })

    it('accepts URL with default port (omitted)', () => {
      const result = validateExternalUrl('https://example.com/')
      expect(result.ok).toBe(true)
    })

    it('rejects URL with port 8080', () => {
      const result = validateExternalUrl('http://example.com:8080/')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('port')
    })

    it('rejects URL with port 22', () => {
      const result = validateExternalUrl('http://example.com:22/')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('port')
    })
  })

  describe('length', () => {
    it('rejects URL longer than max length', () => {
      const longPath = 'a'.repeat(OGP_URL_MAX_LENGTH)
      const longUrl = `https://example.com/${longPath}`
      expect(longUrl.length).toBeGreaterThan(OGP_URL_MAX_LENGTH)
      const result = validateExternalUrl(longUrl)
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('too_long')
    })

    it('accepts URL just at the max length', () => {
      const base = 'https://example.com/'
      const padding = 'a'.repeat(OGP_URL_MAX_LENGTH - base.length)
      const url = `${base}${padding}`
      expect(url.length).toBe(OGP_URL_MAX_LENGTH)
      const result = validateExternalUrl(url)
      expect(result.ok).toBe(true)
    })
  })

  describe('host / parse', () => {
    it('rejects empty string', () => {
      const result = validateExternalUrl('')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('host')
    })

    it('rejects malformed URL', () => {
      const result = validateExternalUrl('not a url at all')
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('host')
    })
  })
})

describe('isIpInRange', () => {
  describe('IPv4', () => {
    it('detects loopback in 127.0.0.0/8', () => {
      expect(isIpInRange('127.0.0.1', '127.0.0.0/8')).toBe(true)
      expect(isIpInRange('127.255.255.254', '127.0.0.0/8')).toBe(true)
    })

    it('detects 10.0.0.0/8 private addresses', () => {
      expect(isIpInRange('10.0.0.1', '10.0.0.0/8')).toBe(true)
      expect(isIpInRange('10.255.255.255', '10.0.0.0/8')).toBe(true)
    })

    it('detects 192.168.0.0/16 private addresses', () => {
      expect(isIpInRange('192.168.1.1', '192.168.0.0/16')).toBe(true)
    })

    it('detects 172.16.0.0/12', () => {
      expect(isIpInRange('172.16.0.1', '172.16.0.0/12')).toBe(true)
      expect(isIpInRange('172.31.255.254', '172.16.0.0/12')).toBe(true)
      expect(isIpInRange('172.32.0.1', '172.16.0.0/12')).toBe(false)
    })

    it('rejects public IPs', () => {
      expect(isIpInRange('8.8.8.8', '127.0.0.0/8')).toBe(false)
      expect(isIpInRange('1.1.1.1', '10.0.0.0/8')).toBe(false)
      expect(isIpInRange('203.0.113.1', '192.168.0.0/16')).toBe(false)
    })

    it('handles /32 boundary', () => {
      expect(isIpInRange('1.2.3.4', '1.2.3.4/32')).toBe(true)
      expect(isIpInRange('1.2.3.5', '1.2.3.4/32')).toBe(false)
    })
  })

  describe('IPv6', () => {
    it('detects loopback ::1/128', () => {
      expect(isIpInRange('::1', '::1/128')).toBe(true)
      expect(isIpInRange('::2', '::1/128')).toBe(false)
    })

    it('detects fc00::/7 ULA', () => {
      expect(isIpInRange('fc00::1', 'fc00::/7')).toBe(true)
      expect(isIpInRange('fdff::1', 'fc00::/7')).toBe(true)
      // 上位 7bit が一致しなければ範囲外。fb は 1111 1011 で 7bit で fc(1111 110x) と一致しない。
      expect(isIpInRange('fb00::1', 'fc00::/7')).toBe(false)
    })

    it('detects fe80::/10 link-local', () => {
      expect(isIpInRange('fe80::1', 'fe80::/10')).toBe(true)
      expect(isIpInRange('febf::ffff', 'fe80::/10')).toBe(true)
      expect(isIpInRange('fec0::1', 'fe80::/10')).toBe(false)
    })

    it('detects ::ffff:0:0/96 IPv4-mapped', () => {
      // ::ffff:127.0.0.1 (IPv4-mapped notation) も判定される。
      expect(isIpInRange('::ffff:7f00:1', '::ffff:0:0/96')).toBe(true)
    })

    it('returns false for malformed inputs without throwing', () => {
      expect(isIpInRange('not-an-ip', '::1/128')).toBe(false)
      expect(isIpInRange('::1', 'invalid-cidr')).toBe(false)
    })
  })
})

describe('resolveAndCheckDns', () => {
  /**
   * 固定マップから IP を返す fake lookup ファクトリ。
   * 同じ key を呼ぶたびに同じ値を返すので、リバインディングなしのデフォルト。
   */
  function makeFakeLookup(map: Record<string, readonly string[]>): (host: string) => Promise<readonly string[]> {
    return async (host: string) => {
      const ips = map[host]
      if (ips === undefined) {
        throw new Error(`no fake entry for ${host}`)
      }
      return ips
    }
  }

  it('returns ok for public host', async () => {
    const lookup = makeFakeLookup({
      'public.example.com': ['8.8.8.8'],
    })
    const result = await resolveAndCheckDns('public.example.com', lookup)
    expect(result.ok).toBe(true)
    expect(result.resolvedIps).toEqual(['8.8.8.8'])
  })

  it('rejects host resolving to private IP', async () => {
    const lookup = makeFakeLookup({
      'internal.example.com': ['10.0.0.1'],
    })
    const result = await resolveAndCheckDns('internal.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ip_private')
  })

  it('rejects host resolving to loopback', async () => {
    const lookup = makeFakeLookup({
      'localhost.example.com': ['127.0.0.1'],
    })
    const result = await resolveAndCheckDns('localhost.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ip_loopback')
  })

  it('rejects host resolving to multicast IP', async () => {
    const lookup = makeFakeLookup({
      'mcast.example.com': ['239.0.0.1'],
    })
    const result = await resolveAndCheckDns('mcast.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ip_multicast')
  })

  it('rejects when any of multiple IPs is private (mixed result)', async () => {
    const lookup = makeFakeLookup({
      'mixed.example.com': ['8.8.8.8', '10.0.0.1'],
    })
    const result = await resolveAndCheckDns('mixed.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ip_private')
  })

  it('returns unresolved when lookup throws', async () => {
    const lookup = async (): Promise<readonly string[]> => {
      throw new Error('ENOTFOUND')
    }
    const result = await resolveAndCheckDns('missing.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unresolved')
  })

  it('returns unresolved when lookup returns empty', async () => {
    const lookup = async (): Promise<readonly string[]> => []
    const result = await resolveAndCheckDns('empty.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unresolved')
  })

  it('rejects DNS rebinding (different result on 2nd lookup)', async () => {
    let callCount = 0
    const lookup = async (): Promise<readonly string[]> => {
      callCount += 1
      // 1 回目: 公開 IP / 2 回目: 内部 IP  という攻撃パターン。
      return callCount === 1 ? ['8.8.8.8'] : ['10.0.0.1']
    }
    const result = await resolveAndCheckDns('rebind.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unresolved')
  })

  it('accepts when both lookups return the same IP set in different order', async () => {
    let callCount = 0
    const lookup = async (): Promise<readonly string[]> => {
      callCount += 1
      return callCount === 1 ? ['8.8.8.8', '1.1.1.1'] : ['1.1.1.1', '8.8.8.8']
    }
    const result = await resolveAndCheckDns('multi.example.com', lookup)
    expect(result.ok).toBe(true)
  })

  it('rejects IPv6 loopback host', async () => {
    const lookup = makeFakeLookup({
      'v6lo.example.com': ['::1'],
    })
    const result = await resolveAndCheckDns('v6lo.example.com', lookup)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ip_loopback')
  })
})
