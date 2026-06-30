#!/usr/bin/env bash
# On-chain checks for confidential EURC registration and contract wiring.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN=$(node -e "console.log(require('$ROOT/deployments.json').confidential_token.token)")
POLICY=$(node -e "console.log(require('$ROOT/deployments.json').confidential_token.policy)")
ADMIN=$(grep '^CONTRACT_ADMIN_PUBLIC_KEY=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)

pass=0
fail=0
check() {
  local name=$1
  shift
  if "$@" >/tmp/ct_int.log 2>&1; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name"
    cat /tmp/ct_int.log
    fail=$((fail + 1))
  fi
}

echo "=== CT registration semantics ==="
check "G-address admin is NOT CT registered" bash -c "stellar contract invoke --id '$TOKEN' --source-account deployer --network testnet -- confidential_balance --account '$ADMIN' 2>&1 | grep -q '#3501'"
check "is_authorized false without passport bind" bash -c "[[ \$(stellar contract invoke --id '$POLICY' --source-account deployer --network testnet -- is_authorized --account '$ADMIN' --token '$TOKEN' 2>&1 | tail -1) == \"false\" ]]"

echo "=== Results: $pass passed, $fail failed ==="
[[ "$fail" -eq 0 ]]
