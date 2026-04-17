#!/bin/bash
#
# assert-no-external-images.sh
#
# ビルド成果物 (frontend/.output/public/) の HTML を走査し、外部ホストから
# 読み込んでいる <img> / og:image が含まれていないことを検証する。
#
# 許可ホスト:
#   - nozomi.bike (production URL)
#
# 許可パターン:
#   - 相対パス (src="/..." や src="images/...") は検査対象外
#   - http(s):// で始まる URL のホスト部分を抽出し、許可リストと照合
#
# ヒットしたら exit 1 でデプロイ前ゲートを落とす。

set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_LEAKED=1

# 許可ホスト (production URL)。カンマ or スペースで増設可能。
readonly -a ALLOWED_HOSTS=(
  "nozomi.bike"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR REPO_ROOT

readonly OUTPUT_DIR="${REPO_ROOT}/frontend/.output/public"

if [[ ! -d "${OUTPUT_DIR}" ]]; then
  echo "assert-no-external-images: output directory not found: ${OUTPUT_DIR}" >&2
  echo "  Run 'npm --prefix frontend run generate' first." >&2
  exit "${EXIT_LEAKED}"
fi

# HTML ファイル一覧を一時ファイルに書き出す (bash 3.2 互換)。
TARGETS_FILE="$(mktemp -t assert-no-external-images.XXXXXX)"
trap 'rm -f "${TARGETS_FILE}"' EXIT

find "${OUTPUT_DIR}" -type f -name '*.html' >"${TARGETS_FILE}"

if [[ ! -s "${TARGETS_FILE}" ]]; then
  echo "assert-no-external-images: no HTML files under ${OUTPUT_DIR}" >&2
  exit "${EXIT_OK}"
fi

# ホスト名が許可リストに含まれるか判定する。
is_allowed_host() {
  local host="$1"
  local allowed
  for allowed in "${ALLOWED_HOSTS[@]}"; do
    if [[ "${host}" == "${allowed}" ]]; then
      return 0
    fi
  done
  return 1
}

# 外部 URL を検出する ERE。og:image は content に URL を持つ形を 2 通り許容:
#   - <meta property="og:image" content="https://..." />
#   - <meta content="https://..." property="og:image" />
# <img src="https://..."> も対象。
readonly IMG_SRC_RE='<img[^>]+src=["'"'"']https?://[^"'"'"' >]+'
readonly OG_IMAGE_CONTENT_FIRST_RE='<meta[^>]+(property|name)=["'"'"']og:image["'"'"'][^>]+content=["'"'"']https?://[^"'"'"' >]+'
readonly OG_IMAGE_CONTENT_LAST_RE='<meta[^>]+content=["'"'"']https?://[^"'"'"' >]+["'"'"'][^>]+(property|name)=["'"'"']og:image["'"'"']'

leaked=0

# それぞれのファイルに対してパターンマッチを走らせる。
# 効率より可読性と誤検知の少なさを優先 (Phase 1 では OGP 画像は先頭 URL だけ)。
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue

  # 抽出対象: <img> の src と og:image の content URL。
  # 3 つの ERE を合成し、grep -o でヒット文字列のみ取得する。
  hits="$(grep -E -o -- "${IMG_SRC_RE}|${OG_IMAGE_CONTENT_FIRST_RE}|${OG_IMAGE_CONTENT_LAST_RE}" "${file}" 2>/dev/null || true)"
  [[ -z "${hits}" ]] && continue

  while IFS= read -r hit; do
    [[ -z "${hit}" ]] && continue

    # hit 文字列から URL を切り出す。最後の https?:// 以降を採用する。
    url="$(printf '%s' "${hit}" | grep -E -o 'https?://[^"'"'"' >]+' | tail -n 1 || true)"
    [[ -z "${url}" ]] && continue

    # スキーム後のホスト部分を抽出する: https://HOST/...
    host="$(printf '%s' "${url}" | sed -E 's|^https?://([^/"'"'"']+).*|\1|')"
    [[ -z "${host}" ]] && continue

    if ! is_allowed_host "${host}"; then
      echo "assert-no-external-images: disallowed external host '${host}' in ${file}" >&2
      echo "  matched: ${hit}" >&2
      leaked=1
    fi
  done <<<"${hits}"
done <"${TARGETS_FILE}"

if [[ ${leaked} -ne 0 ]]; then
  exit "${EXIT_LEAKED}"
fi

echo "OK: no external images in output"
exit "${EXIT_OK}"
