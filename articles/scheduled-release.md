---
title: 予約投稿のテスト
emoji: "⏰"
type: tech
topics:
  - scheduling
  - test
published: true
published_at: '2099-01-01T00:00:00+09:00'
---

# 予約投稿のテスト

この記事は遠い未来の日付で `published_at` を設定しており、
ビルド時にはまだ未来扱いのため本番ビルドには含まれません。
予約投稿の挙動確認に利用します。

## 確認ポイント

- `published: true` かつ `published_at` が未来の場合、本番では
  prerender されない
- preview モードではこの記事も表示される
