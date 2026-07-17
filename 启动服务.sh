#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null || { echo "错误：未安装 Node.js 20 或更高版本" >&2; exit 1; }
command -v npm >/dev/null || { echo "错误：未安装 npm" >&2; exit 1; }

[ -d node_modules ] || npm ci
npm run build

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-8765}"
export SCAN_INTERVAL_MS="${SCAN_INTERVAL_MS:-1200}"

exec npm start
