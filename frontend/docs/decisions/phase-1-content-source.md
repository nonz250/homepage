# ADR: Phase 1 Blog コンテンツソース配置方式

- **Status**: Accepted
- **Date**: 2026-04-17
- **Phase**: Phase 1 (MVP Blog)
- **Scope**: `@nuxt/content` v3 でのコンテンツ読み込み / 画像配信

## コンテキスト

Phase 1 では Zenn Connect との互換性を保つため、Markdown 原稿と画像を以下のようにリポジトリ root 直下に配置する必要がある。

```
homepage/
├── articles/            # Zenn Connect が読み込む記事ディレクトリ
│   ├── *.md
│   └── images/          # 記事内で参照する画像
└── frontend/            # Nuxt プロジェクト
    ├── content.config.ts
    └── nuxt.config.ts
```

一方、`@nuxt/content` v3 のデフォルトコンテンツディレクトリは `./content` であり、`frontend/` 配下を前提とする。そのため以下を検証する必要があった。

- **V-1**: `frontend/content.config.ts` の `source.cwd` を `../articles` に設定することで、`@nuxt/content` が frontend 外部の記事を読めるか
- **V-2**: `frontend/nuxt.config.ts` の `nitro.publicAssets` を使って `../articles/images` を `/articles-images/` パスで公開配信できるか

## 検証手順

1. `articles/sample.md` を以下の frontmatter 付き最小構成で作成し、本文は `hello` とする

```yaml
---
title: Sample
emoji: "📝"
type: tech
topics:
  - sample
published: false
---

hello
```

2. `articles/images/sample.png` として 1x1 の透過 PNG を配置
3. `frontend/content.config.ts` を作成し、`defineCollection` の `source.cwd` を `resolve(__dirname, '../articles')` に設定
4. `frontend/nuxt.config.ts` に `nitro.publicAssets` で `../articles/images` を `/articles-images` にマウント
5. `npm run generate` でビルド
6. SQLite DB と `.output/public/` を検査して結果を確認

## 検証結果

### V-1: `source.cwd: '../articles'` 方式

- **結果**: OK
- **採用方式**: `source.cwd: resolve(__dirname, '../articles')`
- **根拠**: `npm run generate` 後に `.data/content/contents.sqlite` 内の `_content_articles` テーブルを検査し、以下を確認

```
[
  {
    id: 'articles/sample.md',
    path: '/sample',
    title: 'Sample',
    type: 'tech',
    published: 0,
    topics: '["sample"]'
  }
]
```

frontend 外部（リポジトリ root）の `articles/` を正しく収集できることを確認した。

- **フォールバック**: 不要（V-1 が成立したため、symlink 方式は採用しない）

### V-2: `nitro.publicAssets` による画像マウント方式

- **結果**: OK
- **採用方式**: `nitro.publicAssets` に `{ dir: resolve(__dirname, '../articles/images'), baseURL: '/articles-images' }` を設定
- **根拠**: `npm run generate` 後に `.output/public/articles-images/sample.png` がビルド成果物として出力されていることを確認した。静的アセットとして配信されるため、SSG/SPA 双方で動作する
- **フォールバック**: 不要（V-2 が成立したため、`hooks['build:before']` + `fs.cp` による手動コピー方式は採用しない）

## 決定

- **V-1**: `frontend/content.config.ts` の `source.cwd` で `../articles` を直接参照する
- **V-2**: `frontend/nuxt.config.ts` の `nitro.publicAssets` で `../articles/images` を `/articles-images` にマウントする

これにより、Zenn Connect の配置規約（リポジトリ root 直下の `articles/`）を維持しつつ、追加のビルドステップや symlink 管理を不要にする。

## 影響

- 記事中の画像参照パスは `/articles-images/<filename>` となる（Zenn 側の相対パスとは異なるが、正規化ロジックで対応予定）
- `articles/` は Nuxt プロジェクトの外側にあるため、`frontend/` ディレクトリのみをパッケージング対象とする CI/CD が壊れないよう注意（`npm run generate` 時に親ディレクトリを参照する）

## 参考

- `frontend/content.config.ts`
- `frontend/nuxt.config.ts` の `nitro.publicAssets`
- `@nuxt/content` v3 ドキュメント: https://content.nuxt.com/
