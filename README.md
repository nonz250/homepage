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
