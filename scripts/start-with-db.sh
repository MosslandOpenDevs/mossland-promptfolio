#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ ! -d "$REPO_ROOT" || ! -r "$REPO_ROOT" || ! -x "$REPO_ROOT" ]]; then
  echo "[promptfolio] repo root is not accessible: $REPO_ROOT" >&2
  exit 1
fi

cd "$REPO_ROOT"

if [[ ! -w "$REPO_ROOT" ]]; then
  echo "[promptfolio] repo root is not writable: $REPO_ROOT" >&2
  exit 1
fi

if [[ ! -d ".data" ]]; then
  mkdir -p .data
fi

if [[ ! -w ".data" ]]; then
  echo "[promptfolio] .data directory is not writable" >&2
  exit 1
fi

# Ensure data dir/db exists before launching
npm run db:init

exec npm run start
