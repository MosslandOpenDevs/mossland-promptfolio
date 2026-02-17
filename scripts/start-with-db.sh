#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Ensure data dir/db exists before launching
npm run db:init

exec npm run start
