#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

print_fs_diagnostics() {
  local target="$1"
  echo "[promptfolio] diagnostics for: $target" >&2
  ls -ld "$target" 2>/dev/null >&2 || true
  stat -f "  perms=%Sp owner=%Su group=%Sg" "$target" 2>/dev/null >&2 || true
  if command -v id >/dev/null 2>&1; then
    echo "  runtime user=$(id -un) uid=$(id -u) gid=$(id -g)" >&2
  fi
}

if [[ ! -d "$REPO_ROOT" || ! -r "$REPO_ROOT" || ! -x "$REPO_ROOT" ]]; then
  echo "[promptfolio] repo root is not accessible: $REPO_ROOT" >&2
  print_fs_diagnostics "$REPO_ROOT"
  echo "[promptfolio] action: verify parent directory permissions and PM2 exec cwd" >&2
  exit 1
fi

cd "$REPO_ROOT"

if [[ ! -w "$REPO_ROOT" ]]; then
  echo "[promptfolio] repo root is not writable: $REPO_ROOT" >&2
  print_fs_diagnostics "$REPO_ROOT"
  echo "[promptfolio] action: grant write permission for runtime user or adjust deploy owner" >&2
  exit 1
fi

if [[ ! -d ".data" ]]; then
  mkdir -p .data
fi

if [[ ! -w ".data" ]]; then
  echo "[promptfolio] .data directory is not writable" >&2
  print_fs_diagnostics "$REPO_ROOT/.data"
  echo "[promptfolio] action: ensure .data is writable for sqlite/runtime artifacts" >&2
  exit 1
fi

# Ensure data dir/db exists before launching
npm run db:init

exec npm run start
