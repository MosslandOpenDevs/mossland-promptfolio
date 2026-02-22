#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${OPERATIONS_BASE_URL:-https://pf.moss.land}"
ENDPOINTS=("/" "/api/health" "/season")
RETRIES="${OPERATIONS_RETRIES:-2}"
RETRY_DELAY_SECS="${OPERATIONS_RETRY_DELAY_SECS:-1}"
FAILURES=0

check_path() {
  local path="$1"
  local attempts=0
  local success=0

  while (( attempts <= RETRIES )); do
    attempts=$((attempts + 1))

    local tmp
    tmp="$(mktemp)"
    local code="000"
    local curl_rc=0
    code=$(curl -sS -o "$tmp" -w '%{http_code}' -m 12 "$BASE_URL$path" 2>/dev/null) || curl_rc=$?

    local len=0
    if [ -s "$tmp" ]; then
      len=$(wc -c < "$tmp")
    fi

    if [[ "$code" == 2* || "$code" == 3* ]]; then
      printf "  %s => %s (%s bytes) [attempt %d/%d]\n" "$path" "$code" "$len" "$attempts" "$((RETRIES + 1))"
      success=1
      rm -f "$tmp"
      break
    fi

    if (( attempts > RETRIES )); then
      printf "  %s => %s (%s bytes) [attempt %d/%d]\n" "$path" "$code" "$len" "$attempts" "$((RETRIES + 1))"
      if [[ "$curl_rc" -eq 28 ]]; then
        echo "  !! timeout detected"
      else
        echo "  !! non-2xx/3xx detected"
      fi
    else
      printf "  %s => %s (%s bytes) [attempt %d/%d, retrying]\n" "$path" "$code" "$len" "$attempts" "$((RETRIES + 1))"
      sleep "$RETRY_DELAY_SECS"
    fi

    rm -f "$tmp"
  done

  if (( success == 0 )); then
    FAILURES=$((FAILURES + 1))
  fi
}

printf "[mossland-promptfolio] checking %s\n" "$BASE_URL"
for path in "${ENDPOINTS[@]}"; do
  check_path "$path"
done

if [[ "$FAILURES" -gt 0 ]]; then
  echo "[mossland-promptfolio] FAILED checks: $FAILURES"
  exit 1
fi

echo "[mossland-promptfolio] all checks passed"
