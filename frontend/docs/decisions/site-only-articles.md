# ADR: 本サイト限定公開記事の配置方式 (site-articles ディレクトリ)

- **Status**: Superseded by `phase-3-qiita-crosspost.md`
- **Superseded Date**: 2026-04-21
- **Reason**: Qiita crosspost 対応に伴い `site-articles/` を唯一の原典とし、
  `articles/` は Zenn Connect 向け生成物として格下げした。両ディレクトリを
  同一コレクションとして読む構成は廃止。
- **Date**: 2026-04-17
- **Phase**: Phase 1 (MVP Blog)
- **Scope**: Zenn Connect 非対象の記事を本サイト側でだけ公開する仕組み
- **Predecessor**: `phase-1-content-source.md` (V-1/V-2)

## コンテキスト

Phase 1 Blog MVP の記事コンテンツは Zenn Connect でリポジトリ直下の
`articles/` を共有する前提で構築している (`phase-1-content-source.md` V-1)。
一方で「Zenn には出さず、本サイト ([nozomi.bike](https://nozomi.bike)) でだけ
公開したい記事」を掲載したいというニーズが後から発生した。

主な用途の例:

- 内輪向けの運用メモ・雑記
- サイト自身の仕様説明ページ
- Zenn のガイドラインからは外れるが本サイトでは許容したい内容

Zenn Connect は `articles/` のみを読み込む固定仕様のため、ここに変更を
加えることなく「Zenn に出さない記事」を置き分ける必要がある。

## 検討した案

### 案 A: frontmatter フラグ (`site_only: true`) で出し分け

1 ディレクトリ (`articles/`) にすべての記事を置き、frontmatter の
`site_only` を真にしたものは Zenn 側に公開しないよう制御する案。

**不成立**: Zenn Connect は frontmatter の `published: true` を見て公開する
ため、`site_only` のような独自フラグは Zenn からは無視される。
- `published: false` + `site_only: true` にすると Zenn からは消えるが、
  本サイト側では既存の下書き多層防御 (`buildPrerenderRoutes` の fail-closed /
  `assert-no-drafts.sh` によるスキャン) が当該記事を弾いてしまう。
- 逆に本サイト側のガードを「`published: false` でも `site_only: true` なら
  出す」と緩めると、Zenn Connect との整合・下書き漏洩防止の観点で安全性が
  大幅に低下する。

### 案 B: 物理的に別ディレクトリで分離 (採用)

Zenn Connect 対象の `articles/` と、本サイト限定の `site-articles/` を別の
ディレクトリに分けて管理する。本サイト側の Nuxt Content はこの 2 つを同じ
`articles` コレクションとして読み込み、ルーティングは `/articles/[slug]` に
統一する。

- Zenn Connect は `articles/` のみ見るため、`site-articles/` は物理的に Zenn
  からは見えない。
- 既存の下書きガード (`published: false` → 非公開) は両ディレクトリに対して
  同じロジックで機能する。
- slug 衝突は build 時に fail させることで、どちらの記事が優先されるか
  不定になる状況を未然に防ぐ。

**採用**: 最も堅実で、既存の防御機構を損なわない。

## 検証

### V-3: Nuxt Content v3 の `source` は `CollectionSource[]` を受け付けるか

`@nuxt/content` v3 の型定義 (`module.d.mts`) によると、`PageCollection<T>` /
`DataCollection<T>` の `source` は以下の union として宣言されている。

```ts
source?: string | CollectionSource | CollectionSource[] | ResolvedCustomCollectionSource;
```

内部的には `DefinedCollection.source` は常に `ResolvedCollectionSource[]` に
正規化されており、複数ディレクトリを配列で渡す API 自体は公式に提供されて
いる。

**検証結果**: OK
- `content.config.ts` の `source` を以下のように 2 要素配列で定義した。

```ts
source: [
  { cwd: resolve(REPO_ROOT, 'articles'), include: '**/*.md' },
  { cwd: resolve(REPO_ROOT, 'site-articles'), include: '**/*.md' },
]
```

- `npm run generate` 実行後、`.data/content/contents.sqlite` の
  `_content_articles` テーブルに両ディレクトリの記事 (`hello`,
  `about-this-site`) が登録されることを確認。
- `.output/public/articles/hello/index.html` と
  `.output/public/articles/about-this-site/index.html` の双方が
  prerender されることを確認。

フォールバック (`articles` / `siteArticles` の 2 collection に分離して
composable 側で merge) は採用不要。

## 決定

- Zenn 共有記事は従来どおり `articles/*.md`
- 本サイト限定公開記事は `site-articles/*.md`
- 本サイトは両ディレクトリを同一 `articles` コレクションとして統合する
  (`content.config.ts` の `source` を配列で定義)
- URL は従来どおり `/articles/[slug]` のみ
- 両ディレクトリで同じ slug を定義した場合は build を失敗させる

## 影響

- `articles/` / `site-articles/` どちらの変更も本サイトのビルドに影響する
  (既存 CI の `npm run generate` 段階で両方読む)。
- `frontend/utils/prerender/loadArticlesFromFs.ts` や
  `frontend/scripts/extract-draft-slugs.mjs` など、build 時に frontmatter を
  直接走査するユーティリティはいずれも両ディレクトリを対象にする必要がある
  (Step 4 / Step 5)。
- `frontend/utils/prerender/detectSlugCollisions.ts` (純関数) と
  `frontend/utils/prerender/collectSlugEntriesFromDirs.ts` (FS ヘルパ) を
  `nuxt.config.ts` の `nitro:config` フックから呼び出し、両ディレクトリに
  同じ slug の `.md` が存在するとビルド前に明示的な Error で fail する
  (Step 3)。
- デプロイ側の `rsync_include.txt` は `/.output/` のみを含むため、
  `site-articles/` そのものが本番サーバへ転送されることはない
  (生成後の HTML のみが転送される)。

## 運用ルール

- **Zenn にも出す記事 → `articles/*.md`**
- **本サイトだけで公開する記事 → `site-articles/*.md`**
- 判断基準は「Zenn の利用規約 / 読者層にとって適切か」「公開範囲を本サイトに
  絞りたいか」。迷った場合は `articles/` 側に置いておけば Zenn Connect 経由で
  広く届く。
- 同じ slug を両方に作らない (build 時に fail する)。

## 参考

- `frontend/content.config.ts`
- `frontend/docs/decisions/phase-1-content-source.md`
- `@nuxt/content` v3 型定義: `node_modules/@nuxt/content/dist/module.d.mts`
