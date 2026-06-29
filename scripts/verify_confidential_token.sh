#!/usr/bin/env bash
# Verify Lumengate Confidential Token stack on testnet (OpenZeppelin Developer Preview).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true; }

CT=$(node -e "console.log(JSON.stringify(require('$ROOT/deployments.json').confidential_token||{}))")
TOKEN=$(node -e "const c=$CT; console.log(c.token||'')")
VERIFIER=$(node -e "const c=$CT; console.log(c.verifier||'')")
AUDITOR=$(node -e "const c=$CT; console.log(c.auditor||'')")
POLICY=$(node -e "const c=$CT; console.log(c.policy||'')")
UNDERLYING=$(node -e "const c=$CT; console.log(c.underlying||'')")
SESSION=$(node -e "console.log(require('$ROOT/deployments.json').session_store||'')")
ADAPTER=$(node -e "console.log(require('$ROOT/deployments.json').rwa_adapter||'')")
POLICY_ID=$(get_env POLICY_ID)
ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)

if [[ -z "$TOKEN" || -z "$VERIFIER" || -z "$AUDITOR" || -z "$POLICY" ]]; then
  echo "FAIL: confidential_token block incomplete in deployments.json" >&2
  exit 1
fi

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

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

echo "=== CT contracts reachable ==="
check "CT token simulates" bash -c "stellar contract invoke --id '$TOKEN' --source-account deployer --network testnet -- compliance_config 2>&1 | grep -q policy"
check "CT verifier has register VK" bash -c "stellar contract invoke --id '$VERIFIER' --source-account deployer --network testnet -- get_verification_key --circuit_type 0 2>&1 | grep -qE '[0-9a-f]{32,}'"
check "CT verifier has transfer VK" bash -c "stellar contract invoke --id '$VERIFIER' --source-account deployer --network testnet -- get_verification_key --circuit_type 2 2>&1 | grep -qE '[0-9a-f]{32,}'"
check "CT auditor key id 1" bash -c "stellar contract invoke --id '$AUDITOR' --source-account deployer --network testnet -- get_key --auditor_id 1 2>&1 | grep -qE '[0-9a-f]{64,}'"
check "CT policy is_authorized rejects unbound" bash -c "[[ \$(stellar contract invoke --id '$POLICY' --source-account deployer --network testnet -- is_authorized --account '$ADMIN' --token '$TOKEN' 2>&1 | tail -1) == \"false\" ]]"
check "underlying EURC SAC reachable" bash -c "[[ -n '$UNDERLYING' ]] && stellar contract invoke --id '$UNDERLYING' --source-account deployer --network testnet -- name 2>&1 | grep -q ."

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
check "deployments.json token id" bash -c "node -e \"const d=require('$ROOT/deployments.json'); process.exit(d.confidential_token&&d.confidential_token.token?'0':'1')\""
check "VITE CT env or deployments fallback" bash -c "node -e \"
const d=require('$ROOT/deployments.json');
const id=process.env.VITE_CONFIDENTIAL_TOKEN_CONTRACT_ID||d.confidential_token.token;
if(!/^C[A-Z0-9]{55}\$/.test(id)) process.exit(1);
\""

echo "=== Results: $pass passed, $fail failed ==="
[[ "$fail" -eq 0 ]]
