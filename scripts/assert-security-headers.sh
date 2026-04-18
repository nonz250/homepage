#!/bin/bash
#
# assert-security-headers.sh
#
# `docker-compose.security-test.yml` で立ち上げた nginx に対して `curl -I` を
# 発行し、Phase 3 Batch D で規定した各種セキュリティヘッダが付与されている
# ことを検証する。1 つでも欠けていれば exit 1 で CI を落とす。
#
# 前提:
#   - 本スクリプト実行時、ローカル 80 番で docker compose 経由の nginx が
#     listen していること。
#   - nginx の conf は `infra/nginx/test.conf` + `infra/nginx/conf.d/`
#     (Phase 3 Batch D 構成) であること。
#
# 検査対象ヘッダ (CSP 系は Report-Only 段階):
#   - Strict-Transport-Security
#   - X-Content-Type-Options
#   - Referrer-Policy
#   - Permissions-Policy
#   - X-Frame-Options
#   - Cross-Origin-Opener-Policy
#   - Content-Security-Policy-Report-Only
#
# bash 3.2 互換 (macOS 付属) を維持する。

set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_FAIL=1

# nginx 起動待ち。CI / ローカルどちらでも 3 秒で概ね十分だが、遅延時は
# 環境変数 SECURITY_HEADERS_WAIT_SECONDS で上書きできる。
readonly DEFAULT_WAIT_SECONDS=3
WAIT_SECONDS="${SECURITY_HEADERS_WAIT_SECONDS:-${DEFAULT_WAIT_SECONDS}}"

sleep "${WAIT_SECONDS}"

readonly HOST="${SECURITY_HEADERS_HOST:-http://localhost}"

HEADERS="$(curl -sI "${HOST}/")"

if [[ -z "${HEADERS}" ]]; then
  echo "assert-security-headers: failed to fetch headers from ${HOST}/" >&2
  exit "${EXIT_FAIL}"
fi

# 期待ヘッダ一覧。bash 3.2 互換のため indexed array で保持する。
readonly -a EXPECTED_HEADERS=(
  'Strict-Transport-Security'
  'X-Content-Type-Options'
  'Referrer-Policy'
  'Permissions-Policy'
  'X-Frame-Options'
  'Cross-Origin-Opener-Policy'
  'Content-Security-Policy-Report-Only'
)

missing=0
for header in "${EXPECTED_HEADERS[@]}"; do
  if ! printf '%s\n' "${HEADERS}" | grep -iq "^${header}:"; then
    echo "FAIL: ${header} header missing" >&2
    missing=1
  fi
done

if [[ ${missing} -ne 0 ]]; then
  echo "---- received headers ----" >&2
  printf '%s\n' "${HEADERS}" >&2
  echo "--------------------------" >&2
  exit "${EXIT_FAIL}"
fi

echo "OK: all security headers present"
exit "${EXIT_OK}"
