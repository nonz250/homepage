#!/bin/bash
#
# assert-public-allowlist.sh
#
# public/*.md の basename が、generator が書き出した public/.allowlist に
# 登録された qiitaSlug 集合に含まれていることを検査する。
# 下記のような事故を防ぐ fail-closed:
#
#   - qiita-cli sync が UUID basename を勝手に書き込んだ場合
#   - 原典から削除された記事が public/ に取り残された場合
#   - 手動で追加されたテスト用ファイルが残っていた場合
#
# Usage:
#   bash scripts/assert-public-allowlist.sh
#
# 違反があれば exit 1。

set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_LEAKED=1

# 判定対象の固定パス (リポジトリ root 直下)。
readonly PUBLIC_DIR="public"
readonly ALLOWLIST_FILE="${PUBLIC_DIR}/.allowlist"

# public/ が存在しない場合は何もチェックしない。
if [[ ! -d "${PUBLIC_DIR}" ]]; then
  echo "assert-public-allowlist: ${PUBLIC_DIR} not found, skipping"
  exit "${EXIT_OK}"
fi

# allowlist が無い場合は "generator を先に走らせていない" 可能性があるので
# fail-closed にする。
if [[ ! -f "${ALLOWLIST_FILE}" ]]; then
  echo "assert-public-allowlist: ${ALLOWLIST_FILE} not found. Run 'npm run generate' first." >&2
  exit "${EXIT_LEAKED}"
fi

# 許容 basename 集合を読み込む (空行を除去)。
allowed=$(grep -v '^\s*$' "${ALLOWLIST_FILE}" 2>/dev/null || true)

violations=0

while IFS= read -r -d '' file; do
  base=$(basename "${file}" .md)
  # dotfile (.allowlist 自身) は対象外。
  if [[ "${base}" == .* ]]; then
    continue
  fi
  found=0
  # allowed が空の場合は "全部 violation" 扱い。
  if [[ -n "${allowed}" ]]; then
    while IFS= read -r name; do
      if [[ "${name}" == "${base}" ]]; then
        found=1
        break
      fi
    done <<<"${allowed}"
  fi
  if [[ "${found}" -eq 0 ]]; then
    echo "assert-public-allowlist: ${file} is not in allowlist" >&2
    violations=$((violations + 1))
  fi
done < <(find "${PUBLIC_DIR}" -maxdepth 1 -type f -name '*.md' -print0)

if [[ "${violations}" -gt 0 ]]; then
  exit "${EXIT_LEAKED}"
fi

echo "OK: all public/*.md basenames are in the allowlist"
exit "${EXIT_OK}"
