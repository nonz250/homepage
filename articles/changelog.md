---
title: v1 リリースノート
emoji: "🎉"
type: tech
topics:
  - release
  - changelog
published: true
published_at: '2026-04-15T00:00:00+09:00'
---

# v1 リリースノート

本サイトの v1 版をリリースしました。最初のバージョンで含まれる主な
変更点を記録しておきます。

## 追加された主な機能

- Nuxt 3 ベースの SSR + SSG 構成
- Zenn Connect 互換の記事ディレクトリ (`articles/`) 対応
- `/articles-images/` での画像静的配信

## 技術的な変更

- Nuxt Content v3 を採用
- prerender ルートはフロントエンドの純関数で導出
- CONTENT_PREVIEW フラグで下書き確認を分離

## 既知の制限

- 一覧ページ・個別ページの UI は次バッチで実装予定
- RSS / サイトマップは Phase 2 以降で検討
