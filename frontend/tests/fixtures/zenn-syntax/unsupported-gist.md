---
title: gist syntax fixture (formerly unsupported, supported since Phase 3 Batch C2)
---

# Gist syntax

Phase 3 Batch C2 で `@[gist]` 記法に対応した。fixture 名は歴史的経緯で
`unsupported-gist.md` のままだが、本ファイルは pipeline が throw しない
ことを確認する用途で使う。URL は validator 要件 (GitHub ユーザ名規則 +
20〜40 文字の小文字 16 進 hash) を満たす形。

@[gist](https://gist.github.com/user/abcdef1234567890abcd)
