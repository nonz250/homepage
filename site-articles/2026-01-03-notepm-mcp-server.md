---
title: "Claude Code に NotePM MCPサーバーを作ってもらった話"
emoji: "🤖"
type: "tech"
topics: ["ai", "mcp", "claudecode", "typescript", "npm"]
published: true
published_at: '2026-01-03T01:23:08+09:00'
site: true
zenn: false
qiita: false
---

**※この記事は Claude Code に書かせたものに加筆修正を加えたものです。**

こんにちは、のんです。

この記事は、[NotePM](https://notepm.jp/)（日本製のナレッジ共有サービス）の非公式 MCP サーバーを開発し、npm パッケージとして公開するまでの記録です。

## はじめに

もうすでに世の中ではAIだけで何かを作ってる方々がいらっしゃると思います。私もちょうど良さそうな大きさで、ちょうど今欲しいものがあったので、これを機会にやってみようという話です。

## 前提: 私は何もしない縛り

- 設計
- 実装
- テスト
- ドキュメント作成
- コードレビュー
- CI/CD 構築
- npm 公開（は流石にちょっとやった）

上記すべて Claude Code との対話だけで完成させました。この記事では、その過程で直面した課題と、どう解決したかを共有します。

---

## 作ったもの

@[card](https://github.com/nonz250/notepm-mcp-server)

Claude Desktop や Claude Code から NotePM の情報を読み取り・編集できる MCP サーバーです。

```bash
# インストール
npx -y @nonz250/notepm-mcp-server

# Claude Code での利用
claude mcp add notepm \
  --env NOTEPM_TEAM_DOMAIN=your-team \
  --env NOTEPM_ACCESS_TOKEN=your-token \
  -- npx -y @nonz250/notepm-mcp-server
```

### 提供するツール

| ドメイン | ツール | 説明 |
|----------|--------|------|
| Notes | `list_notes` | ノート一覧を取得 |
| Pages | `search_pages` | ページを検索 |
| Pages | `get_page` | ページ詳細を取得 |
| Pages | `create_page` | ページを作成 |
| Pages | `update_page` | ページを更新 |
| Folders | `list_folders` | フォルダ一覧を取得 |
| Tags | `list_tags` | タグ一覧を取得 |
| Tags | `create_tag` | タグを作成 |

---

## 課題 1: MCP サーバーの基盤構築

### 最初の指示

最初に Claude に出した指示は非常にシンプルでした。

> 「NotePM の MCP サーバーを作って。API ドキュメントはこれ」

NotePM の [API ドキュメント](https://notepm.jp/docs/api) の URL を渡し、「全部読んで」と指示しただけです。実装方法、アーキテクチャ、使用するライブラリ、すべて Claude に任せました。

というのも、私自身2025年全般忙しくて AI の動向を追えてなかったんです。ついこないだまで「MCP サーバーってなんや？」って感じでした。

正直、このツールを使った今でもよくわかっていません（冗談半分ですが、大体あってます）。

### Claude がやったこと

Claude は以下を自律的に進めました。

1. **API ドキュメントの理解** - NotePM API の仕様を読み込み
2. **MCP SDK の選定** - `@modelcontextprotocol/sdk` を採用
3. **基本構造の設計** - エントリポイント、HTTP クライアント、ツール定義
4. **初期実装** - Notes, Pages, Tags の CRUD 操作を実装
5. ユニットテスト実装

最初の実装は単一ファイル（`src/tools.ts`）に全機能が詰め込まれた状態でしたが、まずは動くものができました。

正直うごきゃよかろうで作ってました。
他のプロダクトでも Claude Code で開発してまして、完全とは言えませんがほぼ AI にまかせています。この辺はそのうち別の記事にできたらなと思います。

### この段階での学び

**ゴールを伝えれば、Claude は自分で調べて実装する。**

API ドキュメントの URL を渡すだけで、Claude は Web から情報を取得し、MCP の仕様も理解した上で実装を進めました。細かい指示が不要……とまでは行きませんでしたが、マイクロマネジメントするほどでもありませんでした。

---

## 課題 2: コードの肥大化とドメイン分割

### 問題の発生

開発が進むにつれ、問題が顕在化しました。

- **単一ファイルの肥大化** - `tools.ts` が数百行に膨れ上がった
- **テストが書きにくい** - 依存関係が複雑で単体テストが困難
- **機能追加時のコンフリクト** - 複数の変更が同じファイルに集中

### リファクタリングの指示

Claude への指示は一言。

> 「ドメイン分割して」

### Claude がやったこと

Claude は大規模なリファクタリングを実行しました。

**Before（単一ファイル構造）**

```bash
src/
├── tools.ts          # 全機能が1ファイルに
├── notepm-client.ts  # API クライアント
└── __tests__/
    └── tools.test.ts # 巨大なテストファイル
```

**After（ドメインベース構造）**

```bash
src/
├── shared/           # 共有レイヤー
│   ├── config.ts
│   ├── http-client.ts
│   ├── errors.ts
│   └── types.ts
├── mcp/              # MCP レイヤー
│   ├── tools.ts
│   └── handler.ts
├── notes/            # Notes ドメイン
│   ├── types.ts
│   ├── schemas.ts
│   ├── client.ts
│   ├── handlers.ts
│   └── tools.ts
├── pages/            # Pages ドメイン
│   └── ...
├── tags/             # Tags ドメイン
│   └── ...
└── folders/          # Folders ドメイン
    └── ...
```

**変更規模:** 3,540 行削除、3,097 行追加——実質的な全面書き換えでした。

当該プルリクはこちら。
これが一撃だったのはびっくりですね。

@[card](https://github.com/nonz250/notepm-mcp-server/pull/34)

### テストカバレッジ 100% 達成

リファクタリング後、Claude は各ドメインに対して包括的なテストを追加し、テストカバレッジ 100% を達成しました。

```bash
npm run test:coverage

# ----------------------|---------|----------|---------|---------|
# File                  | % Stmts | % Branch | % Funcs | % Lines |
# ----------------------|---------|----------|---------|---------|
# All files             |     100 |      100 |     100 |     100 |
# ----------------------|---------|----------|---------|---------|
```

### この段階での学び

**「ドメイン分割して」の一言で、Claude は適切なアーキテクチャを設計・実装できる。**

ただし、この規模のリファクタリングを成功させるには、テストが書かれていることが前提です。テストがなければ、リファクタリング後の動作確認ができません。カバレッジが100%というわけではありませんが、前段階でツールそのもののテストコードは書かれてました。

ただし、ここで一つ注意があります。
これは NotePM API を利用したツールなので、当然モックを前提にしています。カバレッジ100％＝動作確認ができた。とは限りません。

---

## 課題 3: 動作確認

前述したようにテストコード作成後でも実際の動作確認をしないと安心できませんでした。
この辺は人間のサガってやつなのかもしれません。

次の命令は明確でした。

> 今作ったツールをあなたが実際に使って動作確認して

最初 Claude は実際に自分で使うことなく、ツールに MCP で伝わる json をそのツールに渡して動作確認をはじめました。（伝われ）
つまり、実際には「自分で作ったツールを自分で使った」わけじゃなかったです。

私はちょっと困りました。あなたが実際に使って動作確認して欲しかったのに、ツールの動作確認のみを行ったのです。

> 自分で作ったツールをローカルビルドしてあなたが使うにはどうすればいいですか？

と聞いてみることにしました。
すると、

```bash
claude mcp add notepm \
--env NOTEPM_TEAM_DOMAIN={{ チーム ID }} \
--env NOTEPM_ACCESS_TOKEN={{ トークン }} \
-- npm run start --prefix {{ repository root の絶対パス }}
```

とのことです。
私はすぐさまセッションを切り、Claude を再起動します。

> ｛NotePMのリンク｝を読んでみて

Claude はそのリンクを読み始めました。どうやら、無事成功したようです。同じ要領で他のツールも動作確認できました。

### この段階での学び

Claude に MCP サーバーの動作確認をしてというとそのサーバーに MCP 形式らしきものを渡して動作確認を始める。自分で作ったものを自分で使うみたいなハイコンテクストな処理はまだできない。

---

## 課題 4: 「AI に何をさせるべきか」の設計判断

### 最初の実装

初期実装では、NotePM API の機能をほぼそのまま MCP ツールとして実装していました。

- `create_note` / `update_note` / `delete_note`
- `create_page` / `update_page` / `delete_page`
- `archive_note` / `unarchive_note`
- `delete_tag`

### 問題意識

しかし、実際に使ってみると違和感がありました。なんかこれ、ただの API ツールじゃね？文章作ってくれるだけやん。

私は色々調べました。AI は知能ですから、認知限界や権限、私との上下関係があるはずです。

そこで出会ったのがこの記事でした。

@[card](https://zenn.dev/ncdc/articles/c1d65b6e939185)

なるほど、確かにこの課題はありそうです。

この記事を読ませた上で、Claude さんに聞いてみました。

> この記事を読んで、あなたがあるとうれしいツールはなんですか？また、それらをあらかじめまとめた方が良さそうですか？あなたの感想が聞きたいです。

1. **破壊的操作は危険** - AI が `delete_page` を実行すると、取り消しできない
2. **管理操作は人間の領域** - ノートのアーカイブは組織の意思決定であり、AI が勝手に判断すべきでない
3. **ツール数の増加** - 確かにツールが多すぎるとトークン消費が増えコストが上がるが、今くらいのツール数なら大丈夫
4. **使用頻度の低さ** - 実際に使われるのは参照系と編集系だけだった

### ツールの再選定

これらを踏まえ、ツールを大幅に削減しました。

**削除したツール:**
- `delete_page`, `delete_note`, `delete_tag` - 破壊的操作
- `archive_note`, `unarchive_note` - 管理操作
- `get_note`, `create_note`, `update_note` - 使用頻度が低い

**残したツール:**
- 参照系: `list_notes`, `search_pages`, `get_page`, `list_folders`, `list_tags`
- 編集系: `create_page`, `update_page`, `create_tag`

### 設計思想の明文化

この判断を CONTRIBUTING.md に明文化しました。

> **Tool Design Philosophy**
>
> This MCP server is designed for AI agents. We intentionally do not expose every NotePM API endpoint as a tool.
>
> We don't implement `delete_page` because **AI making irreversible deletions is risky**. We don't implement `archive_note` because **it's an administrative decision humans should make**.

また、ここでは引用していませんが、当時の Claude が発言した内容も書かれています。

@[card](https://github.com/nonz250/notepm-mcp-server/commit/a5c2330b0ae467e3c7efbc39bf40aaef5e8b4920)

### この段階での学び

**AI に「何をさせないか」を決めることも設計の一部。**

MCP サーバーは「API をそのままラップする」ものではありません。AI エージェントが安全に使えるツールセットを設計することが重要です。

また、AI 自身に使い心地を聞くこともできました。まぁ実質コードレビューなんですが、人間らしい返答をしてくれると少しは安心できるものですね。

---

## 課題 5: npm 公開と Trusted Publishing

### npm パッケージ化

MCP サーバーを npm パッケージとして公開するため、`package.json` を整備しました。

```json
{
  "name": "@nonz250/notepm-mcp-server",
  "bin": {
    "notepm-mcp-server": "dist/index.js"
  },
  "files": ["dist", "!dist/__tests__"],
  "scripts": {
    "prepublishOnly": "npm run build && npm test && npm run lint"
  }
}
```

### GitHub Actions でのリリースフロー

最初はタグ push をトリガーにしていましたが、以下の問題がありました。

- タグ push で即座に publish が実行される
- レビューや承認のプロセスがない

そこで、`workflow_dispatch` + `environment: production` による承認フローに変更しました。

### Trusted Publishing の罠

npm Trusted Publishing（OIDC 認証）を導入しようとして、いくつかの罠にハマりました。

#### 罠 1: `registry-url` を設定すると失敗する

`actions/setup-node` で `registry-url` を設定すると、`.npmrc` に以下が書き込まれます。

```
//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
```

これにより npm が `NODE_AUTH_TOKEN` を探し、OIDC より優先して使用しようとします。

**解決策:** `registry-url` を設定しない

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "22"
    # registry-url は設定しない！
```

#### 罠 2: npm のバージョンが古い

Node.js 22 に付属の npm は古く、OIDC をサポートしていません。

```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in
```

**解決策:** npm を最新版にアップグレード

```yaml
- name: Upgrade npm for OIDC support
  run: npm install -g npm@latest
```

Trusted Publishing には **npm 11.5.1 以上** が必要です。

### 最終的なワークフロー

```yaml
publish:
  runs-on: ubuntu-latest
  environment: production
  permissions:
    contents: write
    id-token: write  # OIDC に必須

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        # registry-url は設定しない

    - run: npm install -g npm@latest
    - run: npm ci
    - run: npm run build
    - run: npm publish --access public --provenance
```

### この段階での学び

**Trusted Publishing は便利だが、ドキュメントにない罠がある。**

- `registry-url` を設定しない
- npm を最新版にアップグレード
- `id-token: write` パーミッションを追加

正直このあたりもわからないまま進めてました。
なんとなくそういう技術があるのは知ってましたが、実際に利用するのは初めてだし、今回は全部 AI に任せる縛りを設けていたので、**あえて自分で調べることはしませんでした。**

registry-url あたりは特に怪しいです。
Trusted Publishing は比較的新しい仕組みのはずなので、最初それを知らずに Token で公開しようとしていた残滓をそのまま放置して出たエラーのような気がします。今となっては知りようもありません。**彼の行った作業全てを眺めていたわけではありませんから…**

---

## 振り返り

### AI との協業で良かったこと

1. **実装スピード** - 数日で完成（その数日もご飯食べたりゲームしたりしてました）
2. **テスト作成** - テストコードも Claude が書いてくれる
3. **設計の壁打ち** - 「ドメイン分割して」で適切なアーキテクチャが得られる
4. **ドキュメント作成** - README, CONTRIBUTING, CLAUDE.md もすべて Claude が作成

### 人間がやったこと

- **ゴールの設定** - 「NotePM の MCP サーバーを作る」
- **判断** - 「delete 系は削除しよう」「ドメイン分割しよう」
- **レビュー** - 生成されたコードの確認（ちょっとだけ）
- **リリース承認** - GitHub Actions の workflow_dispatch をクリック

**コードを書くこと、ドキュメントを書くことは一度もありませんでした。**

### うまくいった理由

1. **明確なゴール** - 「NotePM の MCP サーバーを作る」という明確な目標
2. **参照可能な情報** - API ドキュメントの URL を渡せば Claude が読んでくれる
3. **段階的な進行** - 最初は動くものを作り、後からリファクタリング
4. **テストの存在** - テストがあるからリファクタリングが安全にできる

### 気になること

- セキュリティ
- クオリティ

やはりコード品質は気になりました。（不快とか品質が低いという意味ではなく、単純に興味がある。という意味で）
繰り返すようですが、今回は全て AI に任せるという縛りを設けていたので、コードは最低限**ユーザーに迷惑をかけないこと** のみをレビューしてそれ以外は放置です。

極論、

- ドメイン分割して。と言った割りにあまり分割できてない。
- テストコードのカバレッジを100%にして。と言った割りにテストケースが十分でない（カバレッジばかりに注目してる）。

ということはあるかもしれません。

とはいえ、利用者に迷惑をかけるような処理、コードはないかくらいはちゃんと見たので、そのあたりはご安心ください。

---

## おわりに

Claude Code との協業で、MCP サーバーの開発から npm 公開まで完走できました。

特筆すべきは、**私がコードを書くことは一度もなかった** という点です。設計判断とレビューに集中し、実装は Claude に任せる——この分業により、短期間でプロダクトを作ることができました。

よかったら是非利用してみてください。問題があるようであれば、issue や PR お待ちしております。この辺は**ウェルカム**です。

大層な contributing ファイルがありますが、ぶっちゃけテキトーにレポートしてくれいいです。

**どうせやるのは Claude ですしね笑**

以上です。

AI エージェント向けの MCP サーバーを開発したい方、npm パッケージを公開したい方の参考になれば幸いです。

---

## 参考リンク

- [@nonz250/notepm-mcp-server (npm)](https://www.npmjs.com/package/@nonz250/notepm-mcp-server)
- [notepm-mcp-server (GitHub)](https://github.com/nonz250/notepm-mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [NotePM](https://notepm.jp/)
- [npm Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers/)
- [APIをそのままMCPサーバーにするな](https://zenn.dev/ncdc/articles/c1d65b6e939185)
