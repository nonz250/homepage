#!/bin/bash
#
# assert-no-drafts.sh
#
# ビルド成果物 (frontend/.output/public/) を走査し、下書き記事 (frontmatter の
# published !== true) の slug、および下書き検出用マーカー __DRAFT_MARKER__ が
# 含まれていないことを検証する。ヒットしたら exit 1 でビルド/デプロイを止める。
#
# 走査対象:
#   **/*.html
#   _content/**/*.json
#   _payload.json (root, subdir 問わず)
#   sitemap*.xml (存在すれば)
#   rss.xml / feed.xml (存在すれば)
#   _nuxt/**/*.{js,mjs}
#   ogp/, ogp-images/ (存在すれば、フェーズ 3/4 向け前方互換)
#
# 前提:
#   - リポジトリ root で実行する (bash scripts/assert-no-drafts.sh)
#   - 事前に frontend/ で npm run generate が済んでいる
#   - node および frontend/scripts/extract-draft-slugs.mjs が解決可能
#
# マジックナンバー:
#   - DRAFT_MARKER 文字列は constants/content-security.ts の値と手動同期する
#     (シェルから TS を import できないため)。齟齬の検知は contract テストで
#     カバー済み (fixture articles/draft-feature.md 内のマーカー実在確認)。

set -euo pipefail

readonly DRAFT_MARKER='__DRAFT_MARKER__'
readonly EXIT_OK=0
readonly EXIT_LEAKED=1

# リポジトリ root = このスクリプトの 1 つ上の階層。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR REPO_ROOT

# OUTPUT_DIR / EXTRACT_SCRIPT は環境変数で上書き可 (テスト用途)。production
# では未設定のままで、既存の `frontend/.output/public` と
# `frontend/scripts/extract-draft-slugs.mjs` を参照する。
OUTPUT_DIR="${ASSERT_NO_DRAFTS_OUTPUT_DIR:-${REPO_ROOT}/frontend/.output/public}"
EXTRACT_SCRIPT="${ASSERT_NO_DRAFTS_EXTRACT_SCRIPT:-${REPO_ROOT}/frontend/scripts/extract-draft-slugs.mjs}"
readonly OUTPUT_DIR EXTRACT_SCRIPT

if [[ ! -d "${OUTPUT_DIR}" ]]; then
  echo "assert-no-drafts: output directory not found: ${OUTPUT_DIR}" >&2
  echo "  Run 'npm --prefix frontend run generate' first." >&2
  exit "${EXIT_LEAKED}"
fi

# DRAFT_SLUGS も環境変数で上書き可 (テスト用途)。未設定なら extract helper
# を実行する。テストで直接 slug を流し込めば helper スクリプトを経由しない。
if [[ -z "${ASSERT_NO_DRAFTS_SLUGS_OVERRIDE+x}" ]]; then
  if [[ ! -f "${EXTRACT_SCRIPT}" ]]; then
    echo "assert-no-drafts: helper script not found: ${EXTRACT_SCRIPT}" >&2
    exit "${EXIT_LEAKED}"
  fi
  # 下書き slug を取得 (改行区切り、0 件なら空文字)。
  DRAFT_SLUGS="$(node "${EXTRACT_SCRIPT}")"
else
  DRAFT_SLUGS="${ASSERT_NO_DRAFTS_SLUGS_OVERRIDE}"
fi

# 走査対象を find で列挙する。
# 対象が 1 ファイルも無い場合は grep を呼ばずスキップする。
collect_targets() {
  local -a patterns=(
    '*.html'
    '*.json'
    '*.xml'
    '*.js'
    '*.mjs'
  )
  local -a find_args=(-type f '(')
  local first=1
  local p
  for p in "${patterns[@]}"; do
    if [[ ${first} -eq 1 ]]; then
      find_args+=(-name "${p}")
      first=0
    else
      find_args+=(-o -name "${p}")
    fi
  done
  find_args+=(')')
  find "${OUTPUT_DIR}" "${find_args[@]}"
}

# 走査対象ファイルを一時ファイル (改行区切り) に書き出す。
# macOS の bash 3.2 は mapfile を持たないため、ファイル経由でやりとりする。
TARGETS_FILE="$(mktemp -t assert-no-drafts.targets.XXXXXX)"
trap 'rm -f "${TARGETS_FILE}" /tmp/assert-no-drafts.marker.out /tmp/assert-no-drafts.slug.out' EXIT
collect_targets >"${TARGETS_FILE}"

if [[ ! -s "${TARGETS_FILE}" ]]; then
  echo "assert-no-drafts: no scannable files under ${OUTPUT_DIR}" >&2
  # 成果物が空なら明らかに異常だが、このスクリプトの責務は漏洩検知のみ。
  # 上流 (generate 失敗) で既に落ちているはずなので、ここでは OK で返す。
  exit "${EXIT_OK}"
fi

leaked=0

# DRAFT_MARKER のリーク検査。走査ファイル一覧を xargs 経由で grep に渡す。
# -Z + -0 で null 区切りにし、空白/特殊文字を含むパスにも耐えるようにする。
if tr '\n' '\0' <"${TARGETS_FILE}" | xargs -0 grep -l -F -- "${DRAFT_MARKER}" >/tmp/assert-no-drafts.marker.out 2>/dev/null; then
  if [[ -s /tmp/assert-no-drafts.marker.out ]]; then
    echo "assert-no-drafts: DRAFT_MARKER leaked into build output:" >&2
    while IFS= read -r file; do
      echo "  - ${file}" >&2
      grep -n -F -- "${DRAFT_MARKER}" "${file}" | head -n 3 >&2 || true
    done </tmp/assert-no-drafts.marker.out
    leaked=1
  fi
fi

# 下書き slug のリーク検査 (ファイルパス + 本文両方で検査)。
if [[ -n "${DRAFT_SLUGS}" ]]; then
  while IFS= read -r slug; do
    [[ -z "${slug}" ]] && continue

    # 1. 成果物ファイルのパスに draft slug が含まれていないか
    #    (例: frontend/.output/public/articles/draft-feature/index.html)
    #    - slug 単体ではなく `/${slug}/` など区切り文字で絞り込み、他の slug
    #      が偶然 substring でヒットする事故を避ける。
    PATH_HITS="$(grep -F -- "/${slug}/" "${TARGETS_FILE}" || true)"
    NAME_HITS="$(grep -F -- "/${slug}.html" "${TARGETS_FILE}" || true)"
    if [[ -n "${PATH_HITS}" || -n "${NAME_HITS}" ]]; then
      echo "assert-no-drafts: draft slug '${slug}' found in artifact path:" >&2
      [[ -n "${PATH_HITS}" ]] && while IFS= read -r f; do echo "  - ${f}" >&2; done <<<"${PATH_HITS}"
      [[ -n "${NAME_HITS}" ]] && while IFS= read -r f; do echo "  - ${f}" >&2; done <<<"${NAME_HITS}"
      leaked=1
    fi

    # 2. 本文に /articles/${slug} というリンクが残っていないか
    #    (一覧ページの下書きリンク漏れを検知する)。
    #
    #    slug の substring マッチによる偽陽性を防ぐため、後続に明確な境界文字
    #    のみ許容する。例えば slug が `2026-04-19-ai-rotom` のとき
    #    `/articles/2026-04-19-ai-rotom-tech/` のような別 slug を誤検知しない
    #    ようにする。許容境界:
    #      /   : パス区切り (通常ケース)
    #      "   : HTML 属性値の終端 (href="..." など)
    #      '   : HTML 属性値の終端 (シングルクォート)
    #      <   : HTML タグの開始 (<a href=...> の直後など)
    #      \   : JSON のエスケープ ("link":"/articles/slug\u002ejson" 等)
    #      .   : 拡張子境界 (/articles/slug.html など)
    #      ?   : クエリ文字列の開始 (/articles/slug?foo=bar)
    #      #   : アンカーの開始 (/articles/slug#section)
    #      ) ] : markdown/HTML の括弧 (念のため)
    #      \s  : 改行/空白 (行末参照)
    #      $   : 行末
    #
    #    grep -E (ERE) で slug を固定文字列化するため、事前に正規表現メタ
    #    文字をエスケープする。slug は [a-z0-9-]+ を想定しているが、将来の
    #    変更に備えて fail-safe にエスケープしておく。
    escaped_slug="$(printf '%s' "${slug}" | sed -e 's/[][\/.^$*+?(){}|]/\\&/g')"
    slug_boundary_pattern="/articles/${escaped_slug}(/|\"|'|<|>|\\\\|\.|\?|#|\)|\]|[[:space:]]|$)"
    if tr '\n' '\0' <"${TARGETS_FILE}" | xargs -0 grep -l -E -- "${slug_boundary_pattern}" >/tmp/assert-no-drafts.slug.out 2>/dev/null; then
      if [[ -s /tmp/assert-no-drafts.slug.out ]]; then
        echo "assert-no-drafts: draft slug '${slug}' referenced inside build output:" >&2
        while IFS= read -r file; do
          echo "  - ${file}" >&2
          grep -n -E -- "${slug_boundary_pattern}" "${file}" | head -n 3 >&2 || true
        done </tmp/assert-no-drafts.slug.out
        leaked=1
      fi
    fi
  done <<<"${DRAFT_SLUGS}"
fi

if [[ ${leaked} -ne 0 ]]; then
  exit "${EXIT_LEAKED}"
fi

echo "OK: no drafts in output"
exit "${EXIT_OK}"
