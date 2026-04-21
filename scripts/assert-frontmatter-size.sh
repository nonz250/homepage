#!/bin/bash
#
# assert-frontmatter-size.sh
#
# site-articles/*.md 各ファイルのバイト数が YAML bomb 対策の上限
# (256 KiB = 262144 bytes) を超えていないことを shell から独立検査する。
# (Node.js 側の readArticleFile も同じ上限を適用するが、CI で多層防御する)
#
# Usage:
#   bash scripts/assert-frontmatter-size.sh site-articles
#
# 違反があれば exit 1。

set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_LEAKED=1

# 定数: scripts/lib/constants.ts の YAML_FILE_SIZE_LIMIT_BYTES と同値。
# shell から TS を import できないので手動同期する。
readonly YAML_FILE_SIZE_LIMIT_BYTES=262144

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <dir>" >&2
  exit "${EXIT_LEAKED}"
fi

target_dir="$1"

if [[ ! -d "${target_dir}" ]]; then
  echo "assert-frontmatter-size: target directory not found: ${target_dir}" >&2
  exit "${EXIT_LEAKED}"
fi

violations=0

while IFS= read -r -d '' file; do
  # macOS / Linux 両対応: stat の -c (GNU) / -f (BSD) を順に試す。
  if size=$(stat -c%s "${file}" 2>/dev/null); then
    :
  elif size=$(stat -f%z "${file}" 2>/dev/null); then
    :
  else
    echo "assert-frontmatter-size: could not stat ${file}" >&2
    violations=$((violations + 1))
    continue
  fi
  if [[ "${size}" -gt "${YAML_FILE_SIZE_LIMIT_BYTES}" ]]; then
    echo "assert-frontmatter-size: ${file} is ${size} bytes (> ${YAML_FILE_SIZE_LIMIT_BYTES})" >&2
    violations=$((violations + 1))
  fi
done < <(find "${target_dir}" -type f -name '*.md' -print0)

if [[ "${violations}" -gt 0 ]]; then
  exit "${EXIT_LEAKED}"
fi

echo "OK: all ${target_dir} articles within size limit"
exit "${EXIT_OK}"
