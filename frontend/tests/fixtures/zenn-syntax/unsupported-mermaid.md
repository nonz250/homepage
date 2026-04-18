---
title: unsupported mermaid syntax fixture
---

# Unsupported mermaid syntax

Phase 2 では mermaid の code fence は未対応のため、本フェーズでは未レンダー。
Phase 3 で対応予定。現状ではビルドには通るが、目視確認しやすくするため
ここでは `@[mermaid]` 記法も混ぜて build fail を保証する。

@[mermaid]

```mermaid
graph TD
  A --> B
```
