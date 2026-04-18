/**
 * OGP 取得用 HttpClient の interface 定義 (実装なし)。
 *
 * Phase 3 では fetch 周りの差替え (本番 = Node の `fetch`、テスト = 固定
 * レスポンスを返す fake) を実現するため、Layer 2 として interface を切る。
 * 上位 (`fetchOgp`) は interface のみ依存し、Node 固有の事情 (AbortController,
 * size 上限の ReadableStream 監視 etc.) は本番実装側にカプセル化する。
 *
 * 設計方針:
 *   - リクエスト側オプションは「ハードリミット系」を必須プロパティとして
 *     呼び出し側に強制する。デフォルト値の暗黙化を避け、generate ジョブごとに
 *     設定を 1 箇所 (定数モジュール) で管理する。
 *   - レスポンス側は最終 URL (`finalUrl`) を含める。これは外部 URL がリダイレクト
 *     された場合に sanitize / cache キーを最終 URL ベースで作るため。
 *   - body は `Uint8Array` で返す。HTML 取得後の文字エンコーディング判定は
 *     呼び出し側 (open-graph-scraper ラッパー) の責務。
 */

/**
 * HTTP GET 時に必須となるオプション。タイムアウトやサイズ上限など、ハード
 * リミットは省略不可とすることで「うっかり無制限」を防ぐ。
 */
export interface HttpGetOptions {
  /** リクエスト全体のタイムアウト (ms)。 */
  readonly timeoutMs: number
  /** 受信を許可する最大バイト数。超過したら中断する。 */
  readonly maxBytes: number
  /** 追跡を許すリダイレクトの最大ホップ数。 */
  readonly maxRedirects: number
  /** リクエストヘッダに設定する User-Agent 文字列。 */
  readonly userAgent: string
  /** Cookie 等の認証情報を送らない指定。OGP 取得は常に omit。 */
  readonly credentials: 'omit'
}

/**
 * HTTP レスポンスのうち、OGP 抽出に必要な最小限を取り出した形。
 * Node 標準 `Response` には依存させない (差替えやすさ重視)。
 */
export interface HttpResponse {
  /** HTTP ステータスコード。 */
  readonly status: number
  /**
   * レスポンスヘッダ。キーは小文字に正規化済みであることを期待する。
   * 値が複数の場合は本実装では最後の値で上書きされうる (OGP 用途では問題なし)。
   */
  readonly headers: Readonly<Record<string, string>>
  /** レスポンスボディ。バイナリ列としてそのまま返す。 */
  readonly body: Uint8Array
  /** リダイレクトが発生した場合の最終解決 URL。なければ要求 URL と同じ。 */
  readonly finalUrl: string
}

/**
 * OGP 用に切り出した HTTP GET クライアント。
 * 本番実装は `httpClient.node.ts`、テスト用は `httpClient.fake.ts` が提供する。
 */
export interface HttpClient {
  get(url: string, opts: HttpGetOptions): Promise<HttpResponse>
}
