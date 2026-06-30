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

sync_asset() {
  local asset=$1
  local prefix=$2
  local stack
  stack=$(node -e "
    const d=require('$ROOT/deployments.json');
    const s=d.confidential_tokens?.['$asset']||(('$asset'==='eurc')?d.confidential_token:null);
    if(!s) process.exit(1);
    console.log(JSON.stringify(s));
  ")

  local token verifier auditor policy underlying ledger
  token=$(node -e "console.log(JSON.parse(process.argv[1]).token)" "$stack")
  verifier=$(node -e "console.log(JSON.parse(process.argv[1]).verifier)" "$stack")
  auditor=$(node -e "console.log(JSON.parse(process.argv[1]).auditor)" "$stack")
  policy=$(node -e "console.log(JSON.parse(process.argv[1]).policy)" "$stack")
  underlying=$(node -e "console.log(JSON.parse(process.argv[1]).underlying)" "$stack")
  ledger=$(node -e "console.log(JSON.parse(process.argv[1]).deployed_at_ledger||3352000)" "$stack")

  echo "=== Sync confidential $asset ==="
  if [[ "$asset" == "eurc" ]]; then
    upsert_vercel_env VITE_CONFIDENTIAL_TOKEN_CONTRACT_ID "$token"
    upsert_vercel_env VITE_CONFIDENTIAL_VERIFIER_CONTRACT_ID "$verifier"
    upsert_vercel_env VITE_CONFIDENTIAL_AUDITOR_CONTRACT_ID "$auditor"
    upsert_vercel_env VITE_CONFIDENTIAL_POLICY_CONTRACT_ID "$policy"
    upsert_vercel_env VITE_CONFIDENTIAL_UNDERLYING_ASSET_CONTRACT_ID "$underlying"
    upsert_vercel_env VITE_CONFIDENTIAL_DEPLOYED_AT_LEDGER "$ledger"
    upsert_render_env CONFIDENTIAL_TOKEN_ID "$token"
    upsert_render_env CONFIDENTIAL_VERIFIER_ID "$verifier"
    upsert_render_env CONFIDENTIAL_AUDITOR_ID "$auditor"
    upsert_render_env CONFIDENTIAL_POLICY_ID "$policy"
    upsert_render_env CONFIDENTIAL_UNDERLYING_ID "$underlying"
    upsert_render_env CONFIDENTIAL_DEPLOYED_AT_LEDGER "$ledger"
    upsert_render_env CONFIDENTIAL_AUDITOR_ID_NUM "1"
  else
    upsert_vercel_env "VITE_CONFIDENTIAL_${prefix}_TOKEN_ID" "$token"
    upsert_vercel_env "VITE_CONFIDENTIAL_${prefix}_VERIFIER_ID" "$verifier"
    upsert_vercel_env "VITE_CONFIDENTIAL_${prefix}_AUDITOR_ID" "$auditor"
    upsert_vercel_env "VITE_CONFIDENTIAL_${prefix}_POLICY_ID" "$policy"
    upsert_vercel_env "VITE_CONFIDENTIAL_${prefix}_DEPLOYED_AT_LEDGER" "$ledger"
    upsert_render_env "CONFIDENTIAL_${prefix}_TOKEN_ID" "$token"
    upsert_render_env "CONFIDENTIAL_${prefix}_VERIFIER_ID" "$verifier"
    upsert_render_env "CONFIDENTIAL_${prefix}_AUDITOR_ID" "$auditor"
    upsert_render_env "CONFIDENTIAL_${prefix}_POLICY_ID" "$policy"
    upsert_render_env "CONFIDENTIAL_${prefix}_UNDERLYING_ID" "$underlying"
    upsert_render_env "CONFIDENTIAL_${prefix}_DEPLOYED_AT_LEDGER" "$ledger"
    upsert_render_env "CONFIDENTIAL_${prefix}_AUDITOR_ID_NUM" "1"
  fi
}

echo "=== Vercel ($VERCEL_PROJECT) + Render ($RENDER_SERVICE) ==="
sync_asset eurc EURC
sync_asset usdc USDC
upsert_vercel_env VITE_CONFIDENTIAL_INDEXER_URL "https://lumengate-issuer.onrender.com/ct"
upsert_vercel_env VITE_USDC_SAC_ID "$(node -e "console.log(require('$ROOT/deployments.json').usdc_sac||'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA')")"

echo "Done. Trigger redeploys next."
cp "$ROOT/deployments.json" "$ROOT/app/deployments.json"
