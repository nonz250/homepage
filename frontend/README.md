# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
# yarn
yarn install

# npm
npm install

# pnpm
pnpm install --shamefully-hoist
```

## Development Server

Start the development server on http://localhost:3000

```bash
npm run dev
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## アクセス計測 (GTM)

アクセス計測は Google Tag Manager 経由に一本化している。GA4 タグは GTM コンテナの中で設定し、本リポジトリのコードから直接 gtag.js を読み込まない。アプリ側プラグインの責務は GTM コンテナ本体のロードと `dataLayer` 初期化までで、GA4 measurement ID もアプリ側では保持しない。

### コンテナ ID の設定

GitHub Actions の Repository Settings > Secrets and variables > Actions に `NUXT_PUBLIC_GTM_ID` を登録する。値の形式は `GTM-XXXXXXX`。本番ビルド時のみ読み込まれ、`NODE_ENV !== 'production'` または ID 形式不正なら gtm.js は一切読み込まない (fail-closed)。

### secret 切替手順

旧 secret `NUXT_PUBLIC_GTAG_ID` から新 secret `NUXT_PUBLIC_GTM_ID` への移行手順は次のとおり。

1. GitHub Actions Secrets に `NUXT_PUBLIC_GTM_ID` を登録する
2. 本 PR を merge する
3. deploy 完了後、GA4 リアルタイム / DebugView で受信を確認する
4. 確認できたら旧 `NUXT_PUBLIC_GTAG_ID` を削除する

### GTM コンテナ側の責務

ページビュー送信は plugin 側で行わず、GTM コンテナの Trigger 設定に委譲する。History Change Trigger を使う場合は、Trigger Conditions に Page Path の変化を入れて、ハッシュ変更や同一 URL `pushState` での重複発火を防ぐ。

### CSP について

nginx の `infra/nginx/conf.d/_security-map.conf` で `www.googletagmanager.com` が `script-src` / `img-src` / `connect-src` に許可済み。GTM 経由 GA4 でも追加変更は不要。`'unsafe-inline'` 依存は GTM の DOM 注入実装上必要となる。SRI は GTM の動的配信特性上適用不可。noscript iframe は非実装。
