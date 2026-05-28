# homepage

個人サイト ([nozomi.bike](https://nozomi.bike)) と Zenn を兼ねるリポジトリ。

## ローカルでの記事編集フロー (v5 ローカル運用)

`site-articles/*.md` を編集したら、必ず手元で `npm run generate` (root) を
回し、派生生成物 (`articles/` `public/`) を**同じ commit (または PR)** に
同梱して main に push する。CI 側では generator を呼ばないので、ローカル
generate のし忘れは publish-qiita.yml の verify ジョブで fail-closed に
落ちる (`npm run verify:generated` 等)。

### 基本フロー

1. `site-articles/<slug>.md` を編集
2. リポジトリ root で `npm run generate`
3. `articles/` と `public/` の差分を確認 (`git diff articles public`)
4. site-articles と articles/public をまとめて 1 commit にして push

### 画像を追加するとき

`scripts/generate.ts` は記事中の画像参照を
`https://raw.githubusercontent.com/<owner>/<repo>/<sha>/...` の永続 URL に
書き換える (Qiita 側に限る。Zenn / 本サイトは相対のまま)。`<sha>` は generator
実行時のローカル HEAD の commit SHA。**画像が存在しないコミットに URL が
向くと Qiita 表示で 404 になる**ため、次の順序を守る。

1. 画像ファイルと site-articles の本文を**先に commit** する
2. その commit の HEAD 上で `npm run generate` を回す
3. 出力された articles/public を `git commit --amend` で同じコミットに統合する

これで `<sha>` は画像が存在するコミットを指す。

### CI 側の責務 (v5)

| Workflow | 役割 | 起動条件 (paths) |
| --- | --- | --- |
| `.github/workflows/publish-qiita.yml` | verify (整合性 fail-closed) → qiita-cli publish → 記事 ID の auto-commit | `public/**`, `scripts/**`, `package*.json` 等 |
| `.github/workflows/deploy.yml` | Nuxt SSG (`nuxt generate`) → rsync で本番 nginx に配布 | `frontend/**`, `articles/**`, `site-articles/**`, `scripts/**`, `infra/**` 等 |
| `.github/workflows/test.yml` | 既存 (typecheck / unit / integration / contract / generate / security-headers) | 変更なし |

`publish-qiita.yml` の auto-commit ジョブが書き戻す `public/<slug>.md` の
記事 ID 差分は commit message に `[skip ci]` を付けて自己ループを防ぐ。
push 経路は Deploy key (`AUTO_COMMIT_DEPLOY_KEY`、main の branch ruleset を
bypass するために登録) 経由の SSH。

## Qiita 連携

Qiita 側の記事は `public/*.md` として generator (`scripts/generate.ts`) が
`site-articles/*.md` から**ローカル実行時に派生生成**する。CI 側では
generator を呼ばない。`public/*.md` を手で編集してはいけない (generator
実行時に上書き破棄される)。

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

## 記事の書き分け (v4 単一原典モデル)

記事の原典は `site-articles/*.md` の **1 箇所のみ**。配信先は frontmatter の
`site` / `zenn` / `qiita` 真偽フラグで制御し、`articles/` と `public/` は
generator (`scripts/generate.ts`) が派生生成する成果物である (Zenn Connect と
`qiita-cli` の仕様上、物理ファイル配置が必須なので git 追跡する)。

### 配信フラグ

| フラグ | デフォルト | 効果 |
| --- | --- | --- |
| `site` | `true` | 本サイト (`nozomi.bike`) に公開 |
| `zenn` | `false` | Zenn Connect 向けに `articles/<zennSlug>.md` を生成 |
| `qiita` | `false` | Qiita 向けに `public/<qiitaSlug>.md` を生成 |

- `site` / `zenn` / `qiita` のいずれも `true` でない記事は受理されない
  (配信先なしの記事は定義不可)。
- `zenn: true` のとき `zennSlug` (Zenn の slug 形式) が必須。
- `qiita: true` のとき `qiitaSlug` (Qiita の basename) が必須。
- `published: false` の記事はいずれの配信先にも出力されない (下書き)。
- 型は `zod.strict()` + `z.boolean()` で fail-closed。`"true"` のような
  truthy 文字列は **reject される**。

### 各ディレクトリの役割

| パス | 役割 | 手動編集 |
| --- | --- | --- |
| `site-articles/*.md` | 唯一の原典 | **ここだけ編集する** |
| `articles/*.md` | Zenn Connect が読む派生物 | 禁止 (generator が上書き) |
| `public/*.md` | qiita-cli が読む派生物 | 禁止 (generator が上書き) |

- 原典のファイル名 (拡張子なし) はサイト側 URL (`/articles/[slug]`) の
  slug として使われる。Zenn / Qiita 側の basename は `zennSlug` /
  `qiitaSlug` で独立に指定する (Zenn は過去に公開した slug を保持できる)。
- `zennSlug` 同士 / `qiitaSlug` 同士で衝突すると **ビルドが失敗する**。
- 詳細な設計根拠は ADR
  `frontend/docs/decisions/phase-3-qiita-crosspost.md` を参照
  (旧 `site-only-articles.md` は Superseded)。

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
`integration` / `generate` ジョブ。`security-headers` は `generate` の
artifact を再利用するため、ジョブ自体は env を持たない)。メンテナの
ブランチ (upstream PR) と main push では fetch を実行する。

> NOTE: 本番 nginx 設定の所在 (R-11) は未確定。デプロイ先の nginx を本
> リポジトリに寄せるか、別管理を維持するかは別途確認する。
