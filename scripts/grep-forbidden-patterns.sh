#!/bin/bash
#
# grep-forbidden-patterns.sh
#
# 指定されたディレクトリ (通常は public/) 配下に、Qiita 向け変換で消滅して
# いるはずの Zenn 独自記法が残っていないかを **shell grep** で独立検査する。
# transform パイプラインのバグ / 抜け漏れを二重防御で検出する fail-closed。
#
# 検出対象:
#   - @[xxx](...)        : 変換漏れの Zenn 埋め込み (card/tweet/slideshare 等)
#   - :::message         : Qiita では :::note info/warn に変換されるべき
#   - :::details         : <details>/<summary> 展開されるべき
#   - <script            : スクリプトインジェクション (originalで書いてあっても NG)
#
# 注意:
#   articles/ 配下は **Zenn 向け** のため、@[card] や :::message は正常記法
#   として残す。articles/ を引数に指定しないこと。本スクリプトは Qiita 側
#   (public/) の公開前検査を想定する。
#
# Usage:
#   bash scripts/grep-forbidden-patterns.sh public
#
# 違反があれば exit 1。

set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_LEAKED=1

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <dir> [<dir> ...]" >&2
  exit "${EXIT_LEAKED}"
fi

# 検査対象のディレクトリが存在しなければ skip (未生成の CI 段階に備える)。
targets=()
for dir in "$@"; do
  if [[ -d "${dir}" ]]; then
    targets+=("${dir}")
  fi
done

if [[ ${#targets[@]} -eq 0 ]]; then
  echo "grep-forbidden-patterns: no target directories exist, skipping"
  exit "${EXIT_OK}"
fi

# 禁止パターン (shell から見た POSIX 拡張 regex)。
# - @[xxx](...)   : 埋め込み残存
# - :::message    : Qiita 未対応
# - :::details    : Qiita 未対応 (変換前の素の形)
# - <script       : XSS 警戒
readonly FORBIDDEN_PATTERNS=(
  '@\[[a-z]+\]\('
  ':::message( alert)?(\s|$)'
  ':::details '
  '<script[[:space:]>]'
)

leaked=0

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  # grep -R は対象がファイルで絞り込めないため、find + grep に分解する。
  # --include 相当を find で実現する (bash 3.2 向け)。
  matches="$(
    find "${targets[@]}" -type f -name '*.md' -print0 \
      | xargs -0 grep -n -H -E -- "${pattern}" 2>/dev/null \
      || true
  )"
  if [[ -n "${matches}" ]]; then
    echo "grep-forbidden-patterns: forbidden pattern ${pattern} found:" >&2
    echo "${matches}" | head -n 20 >&2
    leaked=1
  fi
done

if [[ ${leaked} -ne 0 ]]; then
  exit "${EXIT_LEAKED}"
fi

echo "OK: no forbidden patterns in ${targets[*]}"
exit "${EXIT_OK}"
