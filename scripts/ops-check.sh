#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${OPERATIONS_BASE_URL:-https://promptfolio.moss.land}"
ENDPOINTS=("/" "/api/health" "/api/seasons")

check_path() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  local code
  code=$(curl -sS -o "$tmp" -w '%{http_code}' -m 12 "$BASE_URL$path" || echo 000)
  local len=0
  if [ -s "$tmp" ]; then
    len=$(wc -c < "$tmp")
  fi
  printf "  %s => %s (%s bytes)\n" "$path" "$code" "$len"
  if [[ "$code" != 2* && "$code" != 3* ]]; then
    echo "  !! non-2xx/3xx detected"
  fi
  rm -f "$tmp"
}

printf "[mossland-promptfolio] checking %s\n" "$BASE_URL"
for path in "${ENDPOINTS[@]}"; do
  check_path "$path"
done
