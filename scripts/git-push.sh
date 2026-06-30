#!/usr/bin/env bash
# Push to GitHub using GITHUB_TOKEN from .env (never commit .env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

read_env_value() {
  local key="$1"
  local file="$ROOT/.env"
  [ -f "$file" ] || return 0
  awk -F= -v k="$key" '
    $1 == k {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      gsub(/^["'\'']|["'\'']$/, "")
      print
      exit
    }
  ' "$file"
}

GITHUB_TOKEN="${GITHUB_TOKEN:-$(read_env_value GITHUB_TOKEN)}"
: "${GITHUB_TOKEN:?Set GITHUB_TOKEN in .env}"
REPO="${GITHUB_REPO_URL:-$(read_env_value GITHUB_REPO_URL)}"
REPO="${REPO:-https://github.com/goat-dev8/Lumengate.git}"
REMOTE="${REPO/https:\/\//https:\/\/x-access-token:${GITHUB_TOKEN}@}"
cd "$ROOT"
git push "$REMOTE" HEAD:main "$@"
