#!/usr/bin/env bash
# Push to GitHub using GITHUB_TOKEN from .env (never commit .env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a
# shellcheck source=/dev/null
source "$ROOT/.env"
set +a
: "${GITHUB_TOKEN:?Set GITHUB_TOKEN in .env}"
REPO="${GITHUB_REPO_URL:-https://github.com/goat-dev8/Lumengate.git}"
REMOTE="${REPO/https:\/\//https:\/\/x-access-token:${GITHUB_TOKEN}@}"
cd "$ROOT"
git push "$REMOTE" HEAD:main "$@"
