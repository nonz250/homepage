#!/bin/bash
#
# assert-no-qiita-leaked-drafts.sh
#
# public/*.md の frontmatter に `private: true` が含まれていないことを
# shell grep で検査する。`private: true` は Qiita の「限定共有」扱いで、
# リポジトリに混入してしまうと限定共有 URL が外部から推測可能な状態で
# 残る恐れがあるため、fail-closed で強制 reject する。
#
# Usage:
#   bash scripts/assert-no-qiita-leaked-drafts.sh
#
# 違反があれば exit 1。

set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_LEAKED=1
readonly PUBLIC_DIR="public"

if [[ ! -d "${PUBLIC_DIR}" ]]; then
  echo "assert-no-qiita-leaked-drafts: ${PUBLIC_DIR} not found, skipping"
  exit "${EXIT_OK}"
fi

leaked=0

# 先頭の frontmatter ブロック (最初の --- から次の ---) のみを対象に private:true
# を探す。単純化のため、ファイル全体を grep し "^private:[[:space:]]*true" が
# あれば検出する。本文中に同じ文字列が入る可能性は極めて低い。
while IFS= read -r -d '' file; do
  if grep -E -q '^private:[[:space:]]*true[[:space:]]*$' "${file}"; then
    echo "assert-no-qiita-leaked-drafts: ${file} has 'private: true'" >&2
    grep -n -E '^private:[[:space:]]*true[[:space:]]*$' "${file}" >&2 || true
    leaked=1
  fi
done < <(find "${PUBLIC_DIR}" -maxdepth 1 -type f -name '*.md' -print0)

if [[ "${leaked}" -ne 0 ]]; then
  exit "${EXIT_LEAKED}"
fi

echo "OK: no 'private: true' entries under ${PUBLIC_DIR}"
exit "${EXIT_OK}"
