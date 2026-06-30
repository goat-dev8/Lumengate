#!/usr/bin/env bash
# Verify Lumengate Confidential Token stack on testnet (OpenZeppelin Developer Preview).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)

pass=0
fail=0
check() {
  local name=$1
  shift
  if "$@" >/tmp/ct_verify.log 2>&1; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name"
    cat /tmp/ct_verify.log
    fail=$((fail + 1))
  fi
}

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
export STELLAR_NETWORK=testnet
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar network use testnet

verify_stack() {
  local label=$1
  local stack_json=$2
  local TOKEN VERIFIER AUDITOR POLICY UNDERLYING
  TOKEN=$(node -e "const c=$stack_json; console.log(c.token||'')")
  VERIFIER=$(node -e "const c=$stack_json; console.log(c.verifier||'')")
  AUDITOR=$(node -e "const c=$stack_json; console.log(c.auditor||'')")
  POLICY=$(node -e "const c=$stack_json; console.log(c.policy||'')")
  UNDERLYING=$(node -e "const c=$stack_json; console.log(c.underlying||'')")

  if [[ -z "$TOKEN" || -z "$VERIFIER" || -z "$AUDITOR" || -z "$POLICY" ]]; then
    echo "FAIL: $label stack incomplete in deployments.json" >&2
    fail=$((fail + 1))
    return
  fi

  echo "=== CT contracts reachable ($label) ==="
  check "$label token simulates" bash -c "stellar contract invoke --id '$TOKEN' --source-account deployer --network testnet -- compliance_config 2>&1 | grep -q policy"
  check "$label verifier has register VK" bash -c "stellar contract invoke --id '$VERIFIER' --source-account deployer --network testnet -- get_verification_key --circuit_type 0 2>&1 | grep -qE '[0-9a-f]{32,}'"
  check "$label verifier has transfer VK" bash -c "stellar contract invoke --id '$VERIFIER' --source-account deployer --network testnet -- get_verification_key --circuit_type 2 2>&1 | grep -qE '[0-9a-f]{32,}'"
  check "$label auditor key id 1" bash -c "stellar contract invoke --id '$AUDITOR' --source-account deployer --network testnet -- get_key --auditor_id 1 2>&1 | grep -qE '[0-9a-f]{64,}'"
  check "$label policy is_authorized rejects unbound" bash -c "[[ \$(stellar contract invoke --id '$POLICY' --source-account deployer --network testnet -- is_authorized --account '$ADMIN' --token '$TOKEN' 2>&1 | tail -1) == \"false\" ]]"
  check "$label underlying SAC reachable" bash -c "[[ -n '$UNDERLYING' ]] && stellar contract invoke --id '$UNDERLYING' --source-account deployer --network testnet -- name 2>&1 | grep -q ."
}

EURC_STACK=$(node -e "console.log(JSON.stringify(require('$ROOT/deployments.json').confidential_token||{}))")
USDC_STACK=$(node -e "console.log(JSON.stringify(require('$ROOT/deployments.json').confidential_tokens?.usdc||{}))")
TOKEN=$(node -e "const c=$EURC_STACK; console.log(c.token||'')")

verify_stack EURC "$EURC_STACK"
verify_stack USDC "$USDC_STACK"

echo "=== Issuer CT indexer ==="
ISSUER="${ISSUER_SERVICE_URL:-https://lumengate-issuer.onrender.com}"
if curl -sf "$ISSUER/ct/deployments" | grep -q "$TOKEN" 2>/dev/null; then
  echo "PASS: GET /ct/deployments"
  pass=$((pass + 1))
elif curl -sf "$ISSUER/health" | grep -q '"ok":true' 2>/dev/null; then
  echo "SKIP: /ct/deployments (deploy issuer-service update to Render)"
else
  echo "SKIP: issuer not reachable at $ISSUER"
fi

echo "=== Frontend config ==="
check "deployments.json eurc token id" bash -c "node -e \"const d=require('$ROOT/deployments.json'); process.exit(d.confidential_token&&d.confidential_token.token?'0':'1')\""
check "deployments.json usdc token id" bash -c "node -e \"const d=require('$ROOT/deployments.json'); process.exit(d.confidential_tokens&&d.confidential_tokens.usdc&&d.confidential_tokens.usdc.token?'0':'1')\""
check "VITE CT env or deployments fallback" bash -c "node -e \"
const d=require('$ROOT/deployments.json');
const id=process.env.VITE_CONFIDENTIAL_TOKEN_CONTRACT_ID||d.confidential_token.token;
if(!/^C[A-Z0-9]{55}\$/.test(id)) process.exit(1);
\""

echo "=== Results: $pass passed, $fail failed ==="
[[ "$fail" -eq 0 ]]
