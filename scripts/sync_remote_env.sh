#!/usr/bin/env bash
# Push Confidential Token env vars to Vercel (frontend) and Render (issuer) using tokens from .env
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
get_env() { grep "^$1=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true; }

VERCEL_TOKEN="$(get_env vercal_token)"
if [[ -z "$VERCEL_TOKEN" ]]; then VERCEL_TOKEN="$(get_env VERCEL_TOKEN)"; fi
RENDER_KEY="$(get_env RENDER_API_KEY)"
VERCEL_PROJECT="${VERCEL_PROJECT_ID:-prj_4zHHYVgvsxEbnSxvvFzOLS1bOV1R}"
RENDER_SERVICE="${RENDER_SERVICE_ID:-srv-d8tjopreo5us73bidav0}"

if [[ -z "$VERCEL_TOKEN" ]]; then
  echo "Missing vercal_token or VERCEL_TOKEN in .env" >&2
  exit 1
fi
if [[ -z "$RENDER_KEY" ]]; then
  echo "Missing RENDER_API_KEY in .env" >&2
  exit 1
fi

CT=$(node -e "console.log(JSON.stringify(require('$ROOT/deployments.json').confidential_token))")

upsert_vercel_env() {
  local key=$1 value=$2
  local existing
  existing=$(curl -sf -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects/$VERCEL_PROJECT/env" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);const e=(j.envs||[]).find(x=>x.key===process.argv[1]);console.log(e?e.id:'')})" "$key")
  if [[ -n "$existing" ]]; then
    curl -sf -X DELETE -H "Authorization: Bearer $VERCEL_TOKEN" \
      "https://api.vercel.com/v9/projects/$VERCEL_PROJECT/env/$existing" >/dev/null
  fi
  curl -sf -X POST -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
    "https://api.vercel.com/v10/projects/$VERCEL_PROJECT/env" \
    -d "$(node -e "console.log(JSON.stringify({key:process.argv[1],value:process.argv[2],type:'plain',target:['production','preview','development']}))" "$key" "$value")" \
    >/dev/null
  echo "Vercel env: $key"
}

upsert_render_env() {
  local key=$1 value=$2
  curl -sf -X PUT -H "Authorization: Bearer $RENDER_KEY" -H "Content-Type: application/json" \
    "https://api.render.com/v1/services/$RENDER_SERVICE/env-vars/$key" \
    -d "$(node -e "console.log(JSON.stringify({value:process.argv[2]}))" "$key" "$value")" \
    >/dev/null 2>&1 || \
  curl -sf -X POST -H "Authorization: Bearer $RENDER_KEY" -H "Content-Type: application/json" \
    "https://api.render.com/v1/services/$RENDER_SERVICE/env-vars" \
    -d "$(node -e "console.log(JSON.stringify({envVar:{key:process.argv[1],value:process.argv[2]}}))" "$key" "$value")" \
    >/dev/null
  echo "Render env: $key"
}

TOKEN=$(node -e "const c=$CT; console.log(c.token)")
VERIFIER=$(node -e "const c=$CT; console.log(c.verifier)")
AUDITOR=$(node -e "const c=$CT; console.log(c.auditor)")
POLICY=$(node -e "const c=$CT; console.log(c.policy)")
UNDERLYING=$(node -e "const c=$CT; console.log(c.underlying)")
LEDGER=$(node -e "const c=$CT; console.log(c.deployed_at_ledger||3352000)")

echo "=== Vercel ($VERCEL_PROJECT) ==="
upsert_vercel_env VITE_CONFIDENTIAL_TOKEN_CONTRACT_ID "$TOKEN"
upsert_vercel_env VITE_CONFIDENTIAL_VERIFIER_CONTRACT_ID "$VERIFIER"
upsert_vercel_env VITE_CONFIDENTIAL_AUDITOR_CONTRACT_ID "$AUDITOR"
upsert_vercel_env VITE_CONFIDENTIAL_POLICY_CONTRACT_ID "$POLICY"
upsert_vercel_env VITE_CONFIDENTIAL_UNDERLYING_ASSET_CONTRACT_ID "$UNDERLYING"
upsert_vercel_env VITE_CONFIDENTIAL_DEPLOYED_AT_LEDGER "$LEDGER"
upsert_vercel_env VITE_CONFIDENTIAL_INDEXER_URL "https://lumengate-issuer.onrender.com/ct"

echo "=== Render ($RENDER_SERVICE) ==="
upsert_render_env CONFIDENTIAL_TOKEN_ID "$TOKEN"
upsert_render_env CONFIDENTIAL_VERIFIER_ID "$VERIFIER"
upsert_render_env CONFIDENTIAL_AUDITOR_ID "$AUDITOR"
upsert_render_env CONFIDENTIAL_POLICY_ID "$POLICY"
upsert_render_env CONFIDENTIAL_UNDERLYING_ID "$UNDERLYING"
upsert_render_env CONFIDENTIAL_DEPLOYED_AT_LEDGER "$LEDGER"
upsert_render_env CONFIDENTIAL_AUDITOR_ID_NUM "1"

echo "Done. Redeploy Vercel + Render for changes to take effect."
