---
title: "Android の Chrome で Notification API が TypeError になるので ServiceWorker から通知する"
emoji: "🔔"
type: "tech"
topics: ["pwa", "serviceworker", "javascript", "typescript"]
published: true
published_at: '2021-12-21T14:15:09+09:00'
updated_at: '2023-02-19T08:45:36+09:00'
site: true
zenn: false
qiita: false
---

こんにちは。

のんです。

iOS で PWA 対応がついに来ましたね！

@[tweet](https://twitter.com/firt/status/1626332953633603586)

自分も長い間ウォッチしてきましたが、これは大きなニュースでした！

ということで、これまでものんラボでは PWA について記事を書いてきましたが、復習を兼ねて改めてサンプルコードやらアプリやら記事やらを書いている最中でございます。

**ということで、今回は PWA を作成している最中にハマったポイントについて記事にしていきます。**

## 結論

@[card](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification#chrome_notes)

> Chrome for Android will throw a TypeError when calling the Notification constructor. It only supports creating notifications from a service worker. See the Chromium issue tracker for more details.

> Chrome 49 以降では、 incognito モードでは通知が動作しません。
> Android 版 Chrome は Notification コンストラクターを呼び出すと TypeError を発生させます。サービスワーカーからの通知の作成にのみ対応しています。
> 詳しくは Chromium issue tracker をご覧ください。

**Android の Chromium では Notification API は利用できません。** ※2023/02/19 現在

まぁ、ServiceWorker 経由しろって話なんですかね？

iOS でも PWA （ServiceWorker）でしか通知できないようなことが書いてあった気がします（多分）。

これは Web プッシュ通知 Evil に利用してきた Web 界隈（特にブログ）に責任があるように思います。

いや、だって特に必要ない通知が多過ぎでしょ。皆さんも心当たりがあるかと思います。

## 対応方法

実際に動作するデモはこちら。

（※ 現在進行形で更新されています。当時のコードとは違う場合があります。）

@[card](https://pwa.nozomi.bike/)

ServiceWorker では通知は利用できるので ServiceWorker で Notification API を利用します。

そのためにはフロントのコードから ServiceWorker に通知をする必要がありますね。

フロント → ServiceWorker 発火 → 通知

という感じです。そのために `ServiceWorker.postMessage()` を利用します。

```ts
navigator.serviceWorker.controller?.postMessage(message)
```

とか

```js
navigator.serviceWorker.ready.then((registration) => {
  registration.active.postMessage("Hi service worker");
});
```

とか。

詳しくはこちら。

@[card](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/message_event)

このようにした上で、ServiceWorker 上のスクリプトで Notification API を利用します。

```ts
self.addEventListener('message', event => {
  if (event.data !== null) {
    void self.registration.showNotification(event.data, {
      body: 'PWA Sample notification.',
      icon: '/labo-round-icon-192x192.png'
    })
  }
})
```

ServiceWorker 上で通知を発火するので、TypeError を吐かずに通知が実行されます。

## Firefox などブラウザでは通常通り機能する

当然ですが、Chromium ベース以外のブラウザでは正常に動作します。

```ts
const notification = new Notification(message, options);
```

## いやでもアプリが起動している間の通知は画面上でも拾いたくないか？

通常のアプリでは、アプリがアクティブであれば通知をOS上（？）ではなくアプリ上に表示したりしたいですよね。

**そういう意味では ServiceWorker → フロントへの通知も実装したい。**

ということで実装してみました。

```ts
self.addEventListener('message', event => {
  if (event.data !== null) {
    // このコードがあるので通知は送信されますが、
    // ここに渡す内容を制御し条件分岐すれば思い通り自由度高く実装できそう。
    void self.registration.showNotification(event.data, {
      body: 'PWA Sample notification.',
      icon: '/labo-round-icon-192x192.png'
    })

    // 重要なのはこのコード。フロント側にメッセージを通知する。
    event.ports[0].postMessage(event.data)
  }
})
```

```ts
const sendMessage = (message: string): void => {
  const channel = new MessageChannel()
  channel.port1.onmessage = (event) => {
    const result = document.getElementById('message-result')
    if (result !== null) {
      result.innerText = event.data
    }
  }
  navigator.serviceWorker.controller?.postMessage(message, [channel.port2])
}
```

上記のように `MessageChannel` を利用します。

* フロント → ServiceWorker
* ServiceWorker → フロント

の 2 方向に通信を行う必要があるので、`port1` `port2` を間違えないように注意してください。

`port1` では ServiceWorker からの通信を待ち受けます。  
この例では ServiceWorker からメッセージ内容を HTML へ反映させています。  
ここのコードは自分で好きに変更できるので、色々使い道がありそうです。

```ts
channel.port1.onmessage = (event) => {
  const result = document.getElementById('message-result')
  if (result !== null) {
    result.innerText = event.data
  }
}
```

`postMessage` の第 2 引数に `port2` を渡しておきます。

```ts
navigator.serviceWorker.controller?.postMessage(message, [channel.port2])
```

ServiceWorker からこのポートにアクセスしてメッセージを渡す。という仕組みです。

```ts
event.ports[0].postMessage(event.data)
```

これで先程の `channel.port1.onmessage` が発火する。ということですね。

## 最後に

FCM ( Firebase Cloud Messaging ) を利用して、サーバーからの通知は実装したことあったのですが、オフライン対応するために、フロントのみ実装してました。

この勉強をしてた最中にめちゃくちゃハマったので記事にしました。

もう一度デモ環境を貼っておきますが、**このデモはオフラインでも動作するので、是非試してみてください**。

@[card](https://pwa.nozomi.bike/)

最後に GitHub のリンクもどうぞ。

@[card](https://github.com/nonz250/pwa)

オフライン対応、つまりキャッシュ戦略についてはまた別の記事にしようと思っているのでお楽しみに。

とはいえ、結構いい記事やデモサイトはたくさんあるのでオリジナリティを出すのには苦労しそう。

がんばります。

そのときはよしなに。
