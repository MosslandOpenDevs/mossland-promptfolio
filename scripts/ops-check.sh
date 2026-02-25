#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${OPERATIONS_BASE_URL:-https://pf.moss.land}"
ENDPOINTS=("/" "/api/health" "/season")
RETRIES="${OPERATIONS_RETRIES:-2}"
RETRY_DELAY_SECS="${OPERATIONS_RETRY_DELAY_SECS:-1}"
STALE_HOURS_THRESHOLD="${PROMPTFOLIO_STALE_HOURS:-168}"
STRICT_STALE_FAIL="${PROMPTFOLIO_STRICT_STALE_FAIL:-0}"
FAILURES=0
STALE_ALERT=false

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

check_repo_activity() {
  local repo_root latest_commit_epoch latest_commit_iso now_epoch age_hours
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  latest_commit_epoch="$(git -C "$repo_root" log -1 --format=%ct 2>/dev/null || echo 0)"
  latest_commit_iso="$(git -C "$repo_root" log -1 --format=%cI 2>/dev/null || echo unknown)"
  now_epoch="$(date +%s)"

  if [[ "$latest_commit_epoch" =~ ^[0-9]+$ ]] && (( latest_commit_epoch > 0 )); then
    age_hours=$(( (now_epoch - latest_commit_epoch) / 3600 ))
  else
    age_hours=999999
  fi

  if (( age_hours >= STALE_HOURS_THRESHOLD )); then
    STALE_ALERT=true
    echo "[mossland-promptfolio] repo activity: stale (${age_hours}h >= ${STALE_HOURS_THRESHOLD}h, latest=${latest_commit_iso})"
    if [[ "$STRICT_STALE_FAIL" == "1" ]]; then
      FAILURES=$((FAILURES + 1))
    fi
  else
    echo "[mossland-promptfolio] repo activity: fresh (${age_hours}h < ${STALE_HOURS_THRESHOLD}h, latest=${latest_commit_iso})"
  fi
}

printf "[mossland-promptfolio] checking %s\n" "$BASE_URL"
for path in "${ENDPOINTS[@]}"; do
  check_path "$path"
done
check_repo_activity

if [[ "$FAILURES" -gt 0 ]]; then
  echo "[mossland-promptfolio] FAILED checks: $FAILURES"
  exit 1
fi

echo "[mossland-promptfolio] all checks passed"
