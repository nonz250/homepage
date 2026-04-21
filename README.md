# homepage

個人サイト ([nozomi.bike](https://nozomi.bike)) と Zenn を兼ねるリポジトリ。

## Qiita 連携 (v4 コンテンツパイプライン)

Qiita 側の記事は `public/*.md` として generator (`scripts/generate.ts`) が
`site-articles/*.md` から**ビルド時に派生生成**する。`public/*.md` を手で
編集してはいけない (generator 実行時に上書き破棄される)。

### `qiita.config.json` の意味論

| キー | 値 | 意図 |
| --- | --- | --- |
| `includePrivate` | `false` | Qiita 側で `private: true` (Qiita 公開範囲の**限定共有**) になった記事を qiita-cli の publish/pull 対象から除外する |
| `host` / `port` | `localhost` / `8888` | qiita-cli のローカル preview サーバ設定 |

> **重要**: `includePrivate: false` は **Qiita 側 `private` フラグのみを
> 除外**する。本リポジトリの `site-articles/` 側で `published: false`
> (Zenn の下書き) にしていても、Qiita 側では `private` とは別概念のため
> generator/qiita-cli の対象判定に影響しない。下書き漏洩防止は generator
> 本体 (`published !== true` を reject) と `npm run assert:*` の多層防御で
> 担保している。

### Qiita sync はローカル開発者のみ

- CI では `qiita pull` / `qiita sync` 相当の **取得系コマンドは実行しない**
  (publish.yml は publish 系のみ)
- 必要があればローカル開発者が手動で実行する
- 実行前に `.gitignore` が以下を無視していることを必ず確認する
  - `public/.remote/` (qiita-cli のサーバ側キャッシュ)
  - `/public/<uuid>.md` (Qiita から pull された UUID basename)
  - ただし `!public/.allowlist` は tracked で残す (allowlist マニフェスト)
- `public/*.md` は generator 出力のみが git 管理下に入る前提で、CI は
  `npm run assert:public-allowlist` で basename のホワイトリスト外を
  `exit 1` で reject する

### CI で実行される fail-closed アサーション

`scripts/` 配下に並んでいる shell/node スクリプト群で、publish 前に多層
防御をかけている (いずれか 1 つでも fail したらビルド全体を止める):

| スクリプト | 役割 |
| --- | --- |
| `assert-frontmatter-size.sh` | `site-articles/*.md` のバイト上限 (256 KiB) |
| `verify-generated-frontmatter.js` | 生成物 `articles/` `public/` の frontmatter 再 parse |
| `grep-forbidden-patterns.sh public` | Qiita 側で Zenn 独自記法が消え残りしていないか |
| `assert-public-allowlist.sh` | `public/*.md` basename が allowlist 内 |
| `assert-no-qiita-leaked-drafts.sh` | `public/*.md` frontmatter に `private: true` が無い |
| `assert-no-drafts.sh` | Nuxt `generate` 成果物に `published !== true` の slug/MARKER が残らない |
| `assert-no-external-images.sh` | 成果物に外部画像 URL が残らない |
| `assert-security-headers.sh` | nginx 経由のセキュリティヘッダ |

## 記事の書き分け

記事 Markdown は 2 つのディレクトリに分けて管理している。両者は本サイトでは
同じ `articles` コレクションに統合され、URL はどちらも `/articles/[slug]`
の形になる。Zenn Connect が見に行くのは `articles/` のみなので、Zenn に
公開したくない記事は `site-articles/` に置くこと。

| 置き場所 | Zenn に公開される? | 典型的な用途 |
| --- | --- | --- |
| `articles/*.md` | される (Zenn Connect 共有) | 技術記事・雑記など広く公開したいもの |
| `site-articles/*.md` | されない (本サイト限定) | 内輪向け運用メモ・サイト自身の説明など |

- ファイル名 (拡張子なし) がそのまま slug になる。
- 両ディレクトリで同じ slug を使うと **ビルドが失敗する**。衝突を避けること。
- 詳細な設計根拠は ADR `frontend/docs/decisions/site-only-articles.md` を参照。

## サポートしている Zenn 記法 (Phase 2 時点)

本サイトが対応している Zenn 互換記法。記事内で以下の記法を使うと、Zenn と
本サイトの双方で同じように描画される。

| 記法 | 例 | 挙動 |
| --- | --- | --- |
| `:::message` | `:::message\n本文\n:::` | 情報メッセージとして表示 (info レベル) |
| `:::message alert` | `:::message alert\n本文\n:::` | 警告メッセージとして表示 (alert レベル) |
| `:::details <title>` | `:::details クリックして開く\n本文\n:::` | 折りたたみブロック |
| `@[youtube](id)` | `@[youtube](dQw4w9WgXcQ)` | YouTube 動画埋め込み (nocookie ドメイン) |
| `@[codepen](url)` | `@[codepen](https://codepen.io/user/pen/abc123)` | CodePen 埋め込み |
| `@[codesandbox](id-or-share-url)` | `@[codesandbox](https://codesandbox.io/s/mysbx)` | CodeSandbox 埋め込み |
| `@[stackblitz](url)` | `@[stackblitz](https://stackblitz.com/edit/foo)` | StackBlitz 埋め込み |
| `$...$` (インライン数式) | `$E=mc^2$` | KaTeX でレンダリング |
| `$$...$$` (ブロック数式) | `$$\na + b\n$$` | KaTeX でレンダリング (ブロック) |

### 未対応 (Phase 3 で対応予定)

以下の記法を含む記事は **ビルドが失敗する**。Phase 3 対応までは使わないこと。

- `@[card](url)`: ページリンクカード
- `@[tweet](url)`: X/Twitter 埋め込み
- `@[gist](url)`: GitHub Gist 埋め込み
- `@[mermaid]` / ` ```mermaid ` フェンス: Mermaid 図
- `:::warning` / `:::tip` / `:::info` など、`message` / `details` 以外のコンテナ

詳細な設計は ADR `frontend/docs/decisions/phase-2-zenn-syntax.md` を参照。

## タグ別一覧ページ

記事 frontmatter の `topics` ごとに `/articles/tags/[tag]` でタグ別一覧が
閲覧できる。タグはビルド時に集計され、`.output/public/tags.json` としても
emit される (外部利用可)。

## セキュリティヘッダ (Phase 3 Batch D)

nginx を `infra/nginx/` で分割管理し、CSP や HSTS などのセキュリティ
ヘッダを静的配信レイヤで付与する。

- `infra/nginx/default.conf`: 本番向け (proxy_pass で Nuxt SSG にプロキシ)
- `infra/nginx/test.conf`: CI / ローカル検証向け (`.output/public/` を
  static root として配信)
- `infra/nginx/conf.d/_security-map.conf`: CSP の値を http context の map
  として定義 (Report-Only / enforcing の両方を用意)
- `infra/nginx/conf.d/_security-add.conf`: server context から include
  する add_header 群 (HSTS / COOP / X-Frame-Options / CSP-Report-Only 等)

### ローカルでのヘッダ検証

```bash
NO_NETWORK_FETCH=1 npm --prefix frontend run generate
docker compose -f docker-compose.security-test.yml up -d proxy
bash scripts/assert-security-headers.sh
docker compose -f docker-compose.security-test.yml down
```

CI 側は `.github/workflows/test.yml` の `security-headers` job が同手順を
実行する (`infra/nginx/` 配下の変更および main push 時のみ起動)。

### CSP Report-Only 運用

Phase 3 時点では `Content-Security-Policy-Report-Only` で配信し、2 週間
程度の観測期間で違反レポートが出ないことを確認したうえで、Phase 4 の
別 PR で enforcing (`Content-Security-Policy`) に昇格させる予定。
昇格は `_security-add.conf` の 1 行を差し替えるだけで完了する。

### `NO_NETWORK_FETCH`

build 時の OGP 取得 (`@[card]` 記法) をネットワーク呼び出しごと無効化
するフラグ。

- `NO_NETWORK_FETCH=1`: fetch を 1 回も行わず、全てを failure fallback に
  倒す。card 記法はホスト名だけを使った簡易カードとして表示される。
- 未設定 or 空文字: 通常の OGP 取得 (`open-graph-scraper` + 画像ダウンロード)
  を実行する。

CI では fork PR のみ `'1'` に昇格する (`.github/workflows/test.yml` の
`integration` / `build-artifact-scan` / `e2e` / `security-headers` ジョブ)。
メンテナのブランチ (upstream PR) と main push では fetch を実行する。

> NOTE: 本番 nginx 設定の所在 (R-11) は未確定。デプロイ先の nginx を本
> リポジトリに寄せるか、別管理を維持するかは別途確認する。
