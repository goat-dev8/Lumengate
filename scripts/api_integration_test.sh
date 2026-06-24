#!/usr/bin/env bash
# API-level integration checks (issuer + RPC + auditor logic).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISSUER="${ISSUER_URL:-http://127.0.0.1:3001}"

pass=0
fail=0
check() {
  local name=$1
  shift
  if "$@" >/tmp/api_test.log 2>&1; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name"
    cat /tmp/api_test.log
    fail=$((fail + 1))
  fi
}

check "issuer health" curl -sf "$ISSUER/health"
check "issuer metadata" curl -sf "$ISSUER/issuer"
check "issuer policies" curl -sf "$ISSUER/policies"
check "on-chain roots" curl -sf "$ISSUER/roots"
check "credential issuance" curl -sf -X POST "$ISSUER/credential" \
  -H 'Content-Type: application/json' \
  -d '{"walletField":"200","policyKey":"general-eligibility"}'
check "pof nullifier" curl -sf -X POST "$ISSUER/pof/nullifier" \
  -H 'Content-Type: application/json' \
  -d '{"noteSecret":"12345","policyId":"2"}'
check "issuer offerings" bash -c 'curl -sf "$1/offerings" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d.get(\"offerings\",[]))>=6"' _ "$ISSUER"

VIEWING_KEY="${AUDITOR_VIEWING_KEY:-lumengate-auditor-testnet-key}"
check "disclose store" curl -sf -X POST "$ISSUER/disclose/store" \
  -H 'Content-Type: application/json' \
  -d "{\"viewingKey\":\"$VIEWING_KEY\",\"auditorId\":1,\"pack\":{\"version\":1,\"walletAddress\":\"GTEST\",\"proofPublicInputsHex\":\"00\"}}"
check "disclose query" bash -c 'curl -sf -X POST "$1/disclose" -H "Content-Type: application/json" -d "{\"viewingKey\":\"$2\",\"auditorId\":1}" | python3 -c "import sys,json; d=json.load(sys.stdin); assert \"disclosures\" in d"' _ "$ISSUER" "$VIEWING_KEY"

check "issuer by id" bash -c 'curl -sf "$1/issuer/2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert \"issuerId\" in d"' _ "$ISSUER"

COMMITMENT="0x2222222222222222222222222222222222222222222222222222222222222222"
REVOKE_KEY="${REVOKE_API_KEY:-}"
if [[ -n "$REVOKE_KEY" ]]; then
  check "revoke credential" bash -c 'resp=$(curl -sf -X POST "$1/revoke" -H "Content-Type: application/json" -H "Authorization: Bearer $2" -d "{\"commitment\":\"$3\",\"reason\":\"api-integration-test\"}"); python3 -c "import sys,json; d=json.loads(sys.argv[1]); assert d.get(\"ok\") is True" "$resp"' _ "$ISSUER" "$REVOKE_KEY" "$COMMITMENT"
else
  echo "SKIP: revoke (set REVOKE_API_KEY to enable)"
fi

echo "=== API tests: $pass passed, $fail failed ==="
[[ "$fail" -eq 0 ]]
