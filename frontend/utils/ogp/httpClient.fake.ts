/**
 * テスト用 `HttpClient` 実装。
 *
 * `HttpClient` interface (`utils/ogp/httpClient.ts`) を満たす差替え可能な
 * fake で、登録済み URL は固定レスポンスを返し、未登録 URL では throw する。
 * `getCallLog()` で呼び出し履歴を取れるため、「キャッシュヒット時に
 * client.get が呼ばれていない」「リダイレクトホップで複数回呼ばれた」と
 * いった検証が容易になる。
 *
 * 設計方針:
 *   - レスポンスマップは「URL 文字列 → HttpResponse か Error」のマップ。
 *     Error を登録しておくと、ネットワーク失敗を再現できる。
 *   - 履歴は immutable な snapshot として返す (テストが書き換えてしまうのを防ぐ)。
 *   - 副作用なし: 各 get 呼び出しは互いに独立、状態は呼び出し履歴のみ。
 */
import type { HttpClient, HttpGetOptions, HttpResponse } from './httpClient'

/**
 * fake への登録レスポンス値。Error を入れるとその URL は throw される。
 */
export type FakeResponseValue = HttpResponse | Error

/**
 * fake の呼び出し履歴 1 件。
 */
export interface FakeCallLogEntry {
  readonly url: string
  readonly opts: HttpGetOptions
}

export interface FakeHttpClientInit {
  /** URL → 期待レスポンス または投げる Error のマップ。 */
  readonly responses: ReadonlyMap<string, FakeResponseValue>
}

export class FakeHttpClient implements HttpClient {
  private readonly responses: ReadonlyMap<string, FakeResponseValue>
  private readonly callLog: FakeCallLogEntry[] = []

  constructor(init: FakeHttpClientInit) {
    this.responses = init.responses
  }

  /**
   * URL に登録済みのレスポンスを返す。未登録なら throw する (テストの取り
   * こぼしを早期発見するため)。
   */
  async get(url: string, opts: HttpGetOptions): Promise<HttpResponse> {
    this.callLog.push({ url, opts })
    const value = this.responses.get(url)
    if (value === undefined) {
      throw new Error(`FakeHttpClient: no registered response for ${url}`)
    }
    if (value instanceof Error) {
      throw value
    }
    return value
  }

  /**
   * 現時点までの呼び出し履歴を新しい配列としてコピーして返す。
   * テスト側で push しても fake 内部状態が壊れないようにする。
   */
  getCallLog(): readonly FakeCallLogEntry[] {
    return [...this.callLog]
  }
}
