Zenn の差分コードは言語を空白区切りで書く:

```diff js
- const x = 1
+ const x = 2
```

他の言語でも同様:

```diff ts
- const x: number = 1
+ const x: number = 2
```

Qiita 無関係の `diff` 単体はそのまま残す:

```diff
- old
+ new
```

通常言語はそのまま:

```js
const x = 1
```
