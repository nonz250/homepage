# homepage

個人サイト ([nozomi.bike](https://nozomi.bike)) と Zenn を兼ねるリポジトリ。

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
