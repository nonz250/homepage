# ADR: Phase 3 Multi-channel Publishing (Qiita crosspost)

- **Status**: Accepted
- **Date**: 2026-04-21
- **Phase**: Phase 3 (Multi-channel Publishing)
- **Scope**: 単一原典 (`site-articles/*.md`) から本サイト / Zenn Connect /
  Qiita の 3 チャンネルへ記事を同期公開する仕組み
- **Supersedes**: `site-only-articles.md`
- **Related**: `phase-2-zenn-syntax.md` (Zenn 記法パイプラインの前提として維持)

## コンテキスト

Phase 2 までは `articles/` と `site-articles/` を同一コレクションとして読み、
`published` で公開制御していた (`site-only-articles.md`)。Phase 3 で Qiita
crosspost 要件が加わり、Qiita 公式 CLI (`qiita-cli`) は `public/*.md` 固定、
Zenn Connect は `articles/*.md` 固定のため、そのまま 3 チャンネルを独立に
管理すると DRY が崩れ、記法差分吸収・画像 URL 絶対化・下書き漏洩防止など
多層防御の整合も取れなくなる。ここでは「原典は 1 つに固定し、チャンネル別
成果物はすべて生成物として扱う」方針に切り替える。

## 決定

### D-1. 単一原典 + 生成物モデル

- **原典**は `site-articles/*.md` のみ。`articles/*.md` と `public/*.md` は
  `scripts/generate.ts` が原典から生成する成果物
- 生成物ディレクトリは Zenn Connect / qiita-cli の仕様上 git 追跡必須
  (外部 SaaS がクローン時点で物理ファイルを要求する)。`.gitignore` しない
- 原典と生成物の byte 一致は PR-B の自前 stringifier で保証 (raw YAML + 改行)

### D-2. 公開先フラグ (strict bool, fail-closed)

原典 frontmatter に以下 3 フラグを定義。`zod strict()` で未知キー reject、
`z.boolean()` で strict bool 限定 (`"true"` / `1` / `"yes"` などの truthy
文字列も reject)。省略時は安全側 (非公開) に倒す fail-closed。

| フラグ | デフォルト | 意味 |
| --- | --- | --- |
| `site` | `true` | 本サイトに公開 |
| `zenn` | `false` | Zenn Connect (`articles/`) に生成 |
| `qiita` | `false` | Qiita (`public/`) に生成 |

### D-3. 原典は Zenn 記法一択

原典は Zenn 記法で書き、Zenn → Qiita への変換を生成時に行う (逆方向は不採用)。
本サイトは Phase 2 のパイプラインを再利用。Qiita 側が未対応 / 意味差異の大きい
以下は `scripts/generate.ts` が **throw** (fail-closed):
`@[slideshare]` / `@[speakerdeck]` / `@[docswell]` / `@[figma]` / `@[blueprintue]`

### D-4. Qiita 変換は AST ベース・7 個の純関数

- `scripts/lib/syntax/transforms/` 配下に **7 個の純関数** (`:::message`,
  `:::details`, `@[youtube]` iframe 化, 画像 URL 絶対化, 数式, コード言語名,
  未対応記法 throw 等) として分割
- 変換順序は `scripts/lib/syntax/transforms/index.ts` の **単一配列** に集約し、
  unified へ順序通り渡す (順序依存の単一情報源)
- 各関数は mdast / hast を入出力とする純関数。文字列 regex 置換は不採用
  (コードブロック内の誤マッチ回避)

### D-5. 画像 URL は commit SHA 固定

Qiita 向け画像は raw.githubusercontent.com の絶対 URL に変換する。スキーマ:
`https://raw.githubusercontent.com/<CANONICAL_OWNER>/<CANONICAL_REPO>/<commit_sha>/images/<slug>/<file>`。
`<commit_sha>` は **必ず固定 commit SHA**。`main` / `HEAD` / tag など
**mutable ref は禁止** (後差し替えで内容改変されるリスクを排除)。
`CANONICAL_OWNER` / `CANONICAL_REPO` は定数固定 (forks 実行時も正規 owner を強制)。

### D-6. `ignorePublish` 二段防御

1. 全生成ファイルに `ignorePublish: true` を **常時付与**
2. `qiita: true` の記事のみ、最終段で `ignorePublish: false` に上書き

書き込み直後に同ファイルを **独立に `js-yaml` FAILSAFE_SCHEMA で再 parse** し、
`ignorePublish` の値を assert (stringifier バグで値反転しても検知)。
FAILSAFE_SCHEMA は `y` / `no` 等を bool 解釈しないため、strict に `true` /
`false` 文字列で書き出されていることも同時に担保する。

### D-7. CI は `publish.yml` 1 本に 4 job 直列

`publish.yml` (`push` to `main` トリガ) に **直列** で以下 4 job を内包:
(1) `generate` 原典→`articles/`/`public/` 生成 → (2) `qiita-publish` qiita-cli
同期 → (3) `auto-commit` 生成差分を `GITHUB_TOKEN` で自動 commit & push →
(4) `deploy` 本サイトデプロイ。既存 `deploy.yml` は **`workflow_dispatch` 専用**
に格下げ (手動リリース用バックアップ)。

### D-8. `workflow_run` を採用しない理由

別 workflow で deploy をキックする案も検討したが、GitHub 仕様上
**`GITHUB_TOKEN` による push は `workflow_run` / `push` / `pull_request` を
発火させない** (workflow 無限ループ防止の公式安全装置)。PAT 切替はセキュリティ
上不可。よって 4 job を同一 workflow 内で直列にするのが唯一の合理解。

### D-9. Qiita sync はローカル専用、CI では禁止

逆方向同期 (`sync-articles-from-qiita`) は **CI 禁止**。ローカル開発者のみ手動
実行。qiita-cli は `public/<uuid>.md` 形式の下書きを生成することがあり、commit
されると原典と乖離するため、`public/.allowlist` (公開 slug ホワイトリスト) を
git 追跡し、CI で **allowlist 非掲載 / uuid basename を含むファイルは reject**。
`.gitignore` で `public/.remote/` と uuid basename を除外する。

### D-10. 暫定通過記法 (未解決事項あり)

以下 2 記法は Qiita preview 実機検証が未完のため暫定通過させる。破綻確認次第
D-3 の throw 対象へ移す (「未解決事項」参照):

- `:::details <title>` → `<details><summary>...</summary>...</details>` HTML
  (Qiita は `<details>` レンダリング実績あり)
- `$$...$$` ブロック数式 (Qiita は KaTeX を公式対応、preview 動作実績あり)

### D-11. frontmatter 検証 (strict)

- `zod strict()` で未知キー reject (タイポ事故防止)
- `z.boolean()` で strict bool 限定 (truthy 文字列を reject)
- `z.array(z.string()).max(N)` で topics 上限
- YAML は `js-yaml` FAILSAFE_SCHEMA (全スカラーを文字列扱い) で parse し、
  bool / null / date 等の暗黙解釈を排除した上で zod に渡す

### D-12. パストラバーサル対策 (二重チェック)

画像 allowlist regex
`^images/[a-z0-9][a-z0-9-]*/(?!.*\.\.)[\w./-]+\.(png|jpe?g|gif|webp|svg)$`
で `..` を negative lookahead 拒否。通過後に `path.posix.normalize` を適用し
正規化前後で **bit-exact 一致**しなければ throw。`images/slug/../../secret.md`
や `images/slug/./foo.png` のような入力経路を二重で塞ぐ。

## セキュリティ多層防御

| レイヤ | 対策 |
| --- | --- |
| Input | zod `strict()` + strict bool, FAILSAFE_SCHEMA YAML, ファイルサイズ・行数上限 |
| Transform | 画像パス allowlist + `path.posix.normalize` 二重チェック, SHA 必須化 (mutable ref 禁止), 未対応記法 throw (fail-closed) |
| Output | `ignorePublish: true` 強制上書き + 独立 re-parse (FAILSAFE_SCHEMA) assert |
| CI | `QIITA_TOKEN` は `qiita-publish` step の `env` のみ, fork PR ガード全 job, Action SHA pin, CODEOWNERS |
| Git | `.gitignore` で `public/.remote/` と uuid basename を除外, `public/.allowlist` のみ追跡, auto-commit は `GITHUB_TOKEN` 方式で workflow 無限ループ回避 |

## 実装で生まれた PR 構成

```
PR-A: schema + transforms core (zod schema + 7 純関数 transforms)
PR-B: generator I/O 層 (scripts/generate.ts, byte 一致保証の自前 stringifier,
      生成後の独立 re-parse assert)
PR-C: 既存記事 (ai-rotom 技術編) の site-articles/ 移行と byte 一致検証
PR-D: frontend 6 箇所の site-articles 単一化 + site:true フィルタ
      (content.config.ts を site-articles/ のみに、composable / prerender で
       site === true に絞り込み)
PR-E: CI ワークフロー再編 (publish.yml 4 job 直列, fork ガード, SHA pin,
      CODEOWNERS, deploy.yml を workflow_dispatch 化)
PR-F: 本 ADR (Task #9)
```

## 未解決事項

1. `:::details` / `$$...$$` / `@[slideshare]` の Qiita preview 実機検証は本
   PR 未着手。**週次 cron + opt-in contract test** として別途整備予定。破綻
   検出次第 D-3 の throw 対象へ移行
2. Qiita 側記事削除フローは qiita-cli 非対応のため YAGNI。運用ルール (Qiita
   web UI で手動削除 → 原典の `qiita: false` に戻す) で対応
3. `frontend/content/schema/article.ts` と `scripts/lib/schema/article.ts` の
   DRY 化は ESM / CJS 境界と Nuxt alias (`~/`) の都合で見送り。将来再検討
4. `branch protection` の required review (CODEOWNERS 連動) は GitHub UI 設定
   のため本 PR 未実施。リポジトリ管理者が別途有効化する

## 影響

- 記事作成は `site-articles/*.md` に集約。`articles/` / `public/` を直接編集
  する運用は廃止 (変更は `scripts/generate.ts` 経由のみ)
- 本サイトのコンテンツソースは `site-articles/` 単一になり、
  `phase-2-zenn-syntax.md` / Phase 2 パイプラインはそのまま継続利用される
- Phase 2 で `@[card]` / `@[tweet]` / `@[gist]` / mermaid を追加する場合、
  Qiita 側対応表も同時に更新する必要がある

## 参考

- `scripts/generate.ts`
- `scripts/lib/syntax/transforms/index.ts`
- `scripts/lib/schema/article.ts`
- `frontend/content/schema/article.ts`
- `.github/workflows/publish.yml`
- `.github/workflows/deploy.yml`
- `public/.allowlist`
- `frontend/docs/decisions/site-only-articles.md` (Superseded)
- `frontend/docs/decisions/phase-2-zenn-syntax.md`
- qiita-cli: https://github.com/increments/qiita-cli
- zenn-editor: https://github.com/zenn-dev/zenn-editor
