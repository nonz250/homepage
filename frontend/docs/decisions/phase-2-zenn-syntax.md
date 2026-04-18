# ADR: Phase 2 Zenn 互換記法サポート

- **Status**: Accepted
- **Date**: 2026-04-17
- **Phase**: Phase 2 (Zenn Syntax Parity)
- **Scope**: Zenn 互換 Markdown 記法 (`:::message` / `:::details` / `@[embed]`
  / KaTeX) を本サイトの記事詳細ページで描画する仕組み
- **Predecessor**: `phase-1-content-source.md`, `site-only-articles.md`

## コンテキスト

Phase 1 Blog MVP では `@nuxt/content` v3 のデフォルト markdown parser を
そのまま利用していた。Zenn 独自記法 (`:::message`, `@[youtube](id)` 等) は
変換されないままテキストとして残り、本サイトの記事表示から欠落する状態だった。

Phase 2 では「Zenn Connect 経由で同じ記事を Zenn/本サイトの両方に公開する」
運用を前提とするため、Zenn 互換の代表的な記法を本サイトでも正しく描画する
必要がある。

## 決定

Zenn 記法の remark / rehype プラグインを自作し、Nuxt Content の
markdown pipeline に組み込む。MDC コンポーネント (`components/content/Zenn*.vue`)
経由で描画する。

### パイプライン順序 (nuxt.config.ts に登録)

以下の順序を固定する。pipelineOrder.test.ts で回帰を防ぐ。

1. `remark-parse`                (デフォルト / mdast 化)
2. `remark-mdc`                  (MDC 記法の初期パース / デフォルト)
3. `remark-zenn-container`       (自作: `:::message` / `:::details` を MDC 化)
4. `remark-zenn-embed`           (自作: `@[service](...)` を MDC 化)
5. `remark-zenn-image`           (自作: `/images/` → `/articles-images/`)
6. `remark-math`                 (`$...$` / `$$...$$` を math ノードに昇格)
7. `remark-rehype`               (mdast → hast)
8. `rehype-katex`                (math ノードを KaTeX HTML に)
9. `rehype-assert-no-zenn-leftovers` (自作: 未対応 Zenn 記法が残っていれば throw)

### サポート対象 (Phase 2 スコープ)

| Zenn 記法 | 変換先 MDC コンポーネント | タグ名 (kebab-case) |
| --- | --- | --- |
| `:::message` | `ZennMessage.vue` | `zenn-message` |
| `:::message alert` | `ZennMessage.vue` (`type=alert`) | `zenn-message` |
| `:::details <title>` | `ZennDetails.vue` | `zenn-details` |
| `@[youtube](id-or-url)` | `ZennEmbedYouTube.vue` | `zenn-embed-you-tube` |
| `@[codepen](url-or-path)` | `ZennEmbedCodePen.vue` | `zenn-embed-code-pen` |
| `@[codesandbox](id-or-url)` | `ZennEmbedCodeSandbox.vue` | `zenn-embed-code-sandbox` |
| `@[stackblitz](url-or-path)` | `ZennEmbedStackBlitz.vue` | `zenn-embed-stack-blitz` |
| `$...$` (inline math) | KaTeX SPAN (`class="katex"`) | (既存ライブラリ) |
| `$$...$$` (block math) | KaTeX SPAN (`class="katex-display"`) | (既存ライブラリ) |

#### pascal-kebab 契約 (MDC タグ名規約)

Nuxt Content v3 / `@nuxtjs/mdc` は MDC 記法の tag 名を `scule.pascalCase(tag)`
で Vue コンポーネント名に解決する。kebab-case → PascalCase は **連続大文字**
を単語境界として分割する。

| SFC ファイル名 | kebab-case タグ名 |
| --- | --- |
| `ZennEmbedYouTube.vue` | `zenn-embed-you-tube` (連続大文字 `YT` が分割) |
| `ZennEmbedCodePen.vue` | `zenn-embed-code-pen` |
| `ZennEmbedCodeSandbox.vue` | `zenn-embed-code-sandbox` |
| `ZennEmbedStackBlitz.vue` | `zenn-embed-stack-blitz` |

`frontend/constants/zenn-mdc.ts` に全タグ名を named export で集約して、
plugin 側と MDC 側で double-source にならないよう担保している。

### Phase 3 で対応予定の記法 (現時点では build fail)

以下は `rehype-assert-no-zenn-leftovers` によって build 時に throw される。
Phase 2 完了時点では「明示的に壊れていることを早期に検知する」方針を採る。

- `@[card](url)`: ページリンクカード
- `@[tweet](url)`: X/Twitter 埋め込み
- `@[gist](url)`: GitHub Gist 埋め込み
- `@[mermaid]` / ` ```mermaid ` code fence: Mermaid 図
- `:::warning` / `:::tip` / `:::info` 等の拡張コンテナ

`tests/contract/markdown/unsupportedSyntaxFails.contract.test.ts` で、これら
Phase 3 対応予定記法が Phase 2 では確実に build を落とすことを契約テストで
担保している。

### タグページ `/articles/tags/[tag]` と tags.json 方式

記事 frontmatter の `topics` ごとに一覧ページを生成する。実装方針:

- **Nuxt Content v3 の `queryCollection().where('topics', 'like', '%tag%')` は採用しない**
  - `topics` は JSON シリアライズされた配列として SQLite に格納されるため、
    LIKE 検索だと部分一致境界が曖昧になる (例: `tag1` と `tag10` を区別できない)
- **代わりにビルド時点でタグ index を `Record<tag, slug[]>` として確定する**
  - 純関数 `buildTagsIndex(articles, buildTime, opts)` で導出
  - fail-closed 設計: `buildPrerenderRoutes` と同じく production × preview=true で throw
- **runtime では server handler `/tags.json` から `$fetch` で読み込む**
  - nitro の server route (`server/routes/tags.json.get.ts`) がランタイム
    (`runtimeConfig.tagsIndexJson`) から JSON 文字列を返す
  - `/tags.json` を `nitro.prerender.routes` に追加することで、generate 後は
    `.output/public/tags.json` として emit される (以降は純静的 asset)
- **composable `useTagIndex()` が `$fetch('/tags.json')` を呼び、失敗時は空マップに fail-safe**
- **タグページは `pages/articles/tags/[tag].vue` で `useTagIndex()` と `useArticles()` を合成して描画**

#### `nitro:build:public-assets` hook が使えない理由

当初は `nitro:build:public-assets` hook で `.output/public/tags.json` を直接
書き出す方針を検討したが、Nuxt の build sequence 上、この hook は **prerender
が完了した後** の `build$1(nitro)` 内の `rollup:before` で呼ばれる。prerender
中には tags.json がまだ存在しないため、`$fetch('/tags.json')` が 404 を返し
タグページの prerender が失敗する。

この制約を回避するため:

1. ビルド時のタグ index は `nitro:config` hook で純関数 `buildTagsIndex` から
   算出
2. 算出結果は `nitroConfig.runtimeConfig.tagsIndexJson` に JSON 文字列として
   埋め込む (runtimeConfig は prerender 時の server handler からも参照可能)
3. server handler `/tags.json` は runtimeConfig を参照して同じ JSON を返す
4. `/tags.json` 自体を `nitro.prerender.routes` に明示追加することで、
   generate 成果物として `.output/public/tags.json` が emit される

結果として、dev / runtime / generate 時の全経路で同一 URL (`/tags.json`) から
同一データが取得できる。

## 検証

### V-4: Zenn 公式パイプライン (`zenn-markdown-html`) との意味的等価性

`tests/integration/markdown/zennGolden.spec.ts` で、Zenn 公式の
`markdownToHtml()` と自作 remark/rehype パイプラインを同じ fixture md に
流し、**論理要素 (message.info / embed.youtube / math.block など)** が
多重集合として一致することを検証する。

完全な DOM 一致は両者の表現方針が根本的に違うため不可能 (Zenn:
`<aside class="msg message">`、自作: `<zenn-message type="info">`)。
ゴールデン比較の粒度は「意味の等価性」に留める DSL を採用。

許容差分の DSL の具体例:

```ts
// Zenn 側の class → 論理要素
const ZENN_CLASS_DSL = {
  'msg message': 'message.info',
  'msg alert': 'message.alert',
  'embed-youtube': 'embed.youtube',
  'embed-codepen': 'embed.codepen',
  'embed-codesandbox': 'embed.codesandbox',
  'embed-stackblitz': 'embed.stackblitz',
}
// 自作側の tag 名 → 論理要素
const OURS_TAG_DSL = {
  'zenn-details': 'details',
  'zenn-embed-you-tube': 'embed.youtube',
  // ... 他も同様
}
```

`embed.codesandbox` のみ、両側で valid な URL 形式が根本的に異なる
(Zenn は `https://codesandbox.io/embed/<id>` のみ、自作は `s/<id>` や
素の id のみを受け付ける) ため、fixture を `codesandbox-embed-url.md`
(Zenn 用) と `codesandbox-share-url.md` (自作用) に分離している。それでも
「両側で CodeSandbox embed として扱われる」ことだけは論理要素一致として
検証できる。

### V-5: パイプライン順序の回帰防止

`tests/integration/markdown/pipelineOrder.test.ts` で unified 単独でも同じ
順序を組み、以下を検証している。

- `:::message` / `:::details` 内で KaTeX 数式が正しく展開される
- `@[youtube]` と通常の markdown link が共存できる
- `/images/...` が `/articles-images/...` に書き換わる
- 未対応記法 (`@[card]` / `:::warning`) は build fail する

## 影響

- `articles/*.md` / `site-articles/*.md` のいずれでも Zenn 互換記法が本サイトで
  同じように描画される。Zenn Connect 共有記事は Zenn 側と本サイト側で見た目が
  揃う。
- `katex` の CSS / フォントが初期バンドルに含まれる。数式を使わない記事でも
  ファイルサイズ増 (Phase 2 スコープでは許容)。
- Phase 3 で `@[card]` / `@[tweet]` / `@[gist]` / mermaid を実装する際は、
  `rehypeAssertNoZennLeftovers` から該当 allowlist を緩めつつ、
  contract test (`tests/contract/markdown/unsupportedSyntaxFails.contract.test.ts`)
  も更新する必要がある。

## 参考

- `frontend/utils/markdown/remarkZennContainer.ts`
- `frontend/utils/markdown/remarkZennEmbed.ts`
- `frontend/utils/markdown/remarkZennImage.ts`
- `frontend/utils/markdown/rehypeAssertNoZennLeftovers.ts`
- `frontend/utils/markdown/validateEmbedId.ts`
- `frontend/utils/prerender/buildTagsIndex.ts`
- `frontend/constants/zenn-mdc.ts`
- `frontend/constants/zenn-embed.ts`
- `frontend/constants/tags.ts`
- `frontend/components/content/Zenn*.vue`
- `frontend/server/routes/tags.json.get.ts`
- `frontend/pages/articles/tags/[tag].vue`
- `frontend/composables/useTagIndex.ts`
- `frontend/tests/integration/markdown/pipelineOrder.test.ts`
- `frontend/tests/integration/markdown/zennGolden.spec.ts`
- `frontend/tests/contract/markdown/unsupportedSyntaxFails.contract.test.ts`
- zenn-editor: https://github.com/zenn-dev/zenn-editor
