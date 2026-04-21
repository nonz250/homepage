import { describe, expect, it } from 'vitest'
import { processMarkdownWithOptions } from '../../../helpers/processMarkdown'
import {
  transformImage,
  INVALID_LOCAL_IMAGE_PATH_ERROR_PREFIX,
  type TransformImageOptions,
} from '../../../../scripts/lib/syntax/transforms/transformImage'
import {
  CANONICAL_GITHUB_OWNER,
  CANONICAL_GITHUB_REPO,
  RAW_GITHUBUSERCONTENT_HOST,
} from '../../../../scripts/lib/constants'

describe('transformImage', () => {
  const sampleSha = '0123456789abcdef0123456789abcdef01234567'
  const baseOptions: TransformImageOptions = { commitSha: sampleSha }

  it('rewrites /images/foo.png to a raw.githubusercontent.com permalink', () => {
    const input = '![cat](/images/cat.png)\n'
    const output = processMarkdownWithOptions(input, transformImage, baseOptions)
    const expectedUrl = `https://${RAW_GITHUBUSERCONTENT_HOST}/${CANONICAL_GITHUB_OWNER}/${CANONICAL_GITHUB_REPO}/${sampleSha}/images/cat.png`
    expect(output).toContain(expectedUrl)
  })

  it('rewrites nested paths under /images/', () => {
    const input = '![sample](/images/ai-rotom/sample1.png)\n'
    const output = processMarkdownWithOptions(input, transformImage, baseOptions)
    expect(output).toContain(
      `/${sampleSha}/images/ai-rotom/sample1.png`,
    )
  })

  it('preserves the alt text when rewriting', () => {
    const input = '![開発中のスクリーンショット](/images/shot.png)\n'
    const output = processMarkdownWithOptions(input, transformImage, baseOptions)
    expect(output).toContain('開発中のスクリーンショット')
  })

  it('passes through absolute https URLs', () => {
    const input = '![ext](https://example.com/foo.png)\n'
    const output = processMarkdownWithOptions(input, transformImage, baseOptions)
    expect(output).toContain('https://example.com/foo.png')
    expect(output).not.toContain(RAW_GITHUBUSERCONTENT_HOST)
  })

  it('passes through relative paths (./ and ../)', () => {
    const inputDot = '![rel](./foo.png)\n'
    const outputDot = processMarkdownWithOptions(inputDot, transformImage, baseOptions)
    expect(outputDot).toContain('./foo.png')
    const inputDotDot = '![up](../up/foo.png)\n'
    const outputDotDot = processMarkdownWithOptions(inputDotDot, transformImage, baseOptions)
    expect(outputDotDot).toContain('../up/foo.png')
  })

  it('throws for path traversal under /images/', () => {
    const input = '![](/images/../../etc/passwd)\n'
    expect(() =>
      processMarkdownWithOptions(input, transformImage, baseOptions),
    ).toThrowError(INVALID_LOCAL_IMAGE_PATH_ERROR_PREFIX)
  })

  it('throws for disallowed extensions under /images/', () => {
    const input = '![](/images/foo.pdf)\n'
    expect(() =>
      processMarkdownWithOptions(input, transformImage, baseOptions),
    ).toThrowError(INVALID_LOCAL_IMAGE_PATH_ERROR_PREFIX)
  })

  it('throws for double slashes under /images/ (redundant separator)', () => {
    // `/images/foo//bar.png` は IMAGE_PATH_PATTERN を通過するが、
    // assertSafeImagePath の normalize 検査で reject されるべき。
    // 二重防御 (regex + path.posix.normalize) が両方連携していないと
    // 本ケースは素通しされてしまう。
    const input = '![](/images/foo//bar.png)\n'
    expect(() =>
      processMarkdownWithOptions(input, transformImage, baseOptions),
    ).toThrow()
  })

  it('throws for single-dot segments under /images/ (non-canonical form)', () => {
    // `/images/foo/./bar.png` は regex を通過するが normalize で
    // `/images/foo/bar.png` に縮約される。canonical form でない以上
    // fail-closed で拒否する。
    const input = '![](/images/foo/./bar.png)\n'
    expect(() =>
      processMarkdownWithOptions(input, transformImage, baseOptions),
    ).toThrow()
  })

  it('throws for trailing traversal under /images/ (normalize escape)', () => {
    // regex の negative lookahead `(?!.*\.\.)` で捕捉されない fallback を
    // assertSafeImagePath 側でも落とす。ここでは IMAGE_PATH_PATTERN を
    // 通過する範囲で normalize が別パスに縮約される例として、単独ドット
    // ディレクトリ経由のバリエーションを検証する。
    const input = '![](/images/sub/./nested/pic.png)\n'
    expect(() =>
      processMarkdownWithOptions(input, transformImage, baseOptions),
    ).toThrow()
  })

  it('throws when commitSha is an empty string', () => {
    const input = '![](/images/foo.png)\n'
    expect(() =>
      processMarkdownWithOptions(input, transformImage, { commitSha: '' }),
    ).toThrowError(INVALID_LOCAL_IMAGE_PATH_ERROR_PREFIX)
  })

  it('respects custom owner/repo when provided', () => {
    const input = '![](/images/foo.png)\n'
    const output = processMarkdownWithOptions(input, transformImage, {
      commitSha: sampleSha,
      owner: 'other-user',
      repo: 'other-repo',
    })
    expect(output).toContain('/other-user/other-repo/')
  })

  it('does not touch link nodes that happen to point at /images/', () => {
    const input = '[link](/images/foo.png)\n'
    const output = processMarkdownWithOptions(input, transformImage, baseOptions)
    expect(output).toContain('(/images/foo.png)')
    expect(output).not.toContain(RAW_GITHUBUSERCONTENT_HOST)
  })

  it('is idempotent: already-absolute image URLs are untouched', () => {
    const input = `![](https://${RAW_GITHUBUSERCONTENT_HOST}/${CANONICAL_GITHUB_OWNER}/${CANONICAL_GITHUB_REPO}/${sampleSha}/images/foo.png)\n`
    const once = processMarkdownWithOptions(input, transformImage, baseOptions)
    const twice = processMarkdownWithOptions(once, transformImage, baseOptions)
    expect(twice).toBe(once)
  })
})
