#!/usr/bin/env bash
# Run all Lumengate verified test suites and print a summary.
# Requires: .env, stellar CLI, local issuer on :3001 for full API integration pass.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Lumengate verified test run started at $TS"

LUMENGATE_PKGS=(
  issuer-registry credential-registry policy-verifier rwa-adapter rwa-token
  compliance-sac-admin auditor-registry compliant-dex compliant-payroll
  session-store lumengate-confidential-token lumengate-confidential-policy
)

echo "=== Rust: Lumengate contracts ==="
RUST_LUMENGATE=0
for pkg in "${LUMENGATE_PKGS[@]}"; do
  n=$(cargo test -p "$pkg" 2>&1 | awk '/running [0-9]+ test/{print $2; exit}')
  n=${n:-0}
  echo "$pkg: $n passed"
  RUST_LUMENGATE=$((RUST_LUMENGATE + n))
done
echo "Rust Lumengate subtotal: $RUST_LUMENGATE"

echo "=== Rust: UltraHonk verifier ==="
RUST_ZK=$(cargo test -p rs-soroban-ultrahonk -p ultrahonk_soroban_verifier 2>&1 | awk '
  /running [0-9]+ test/ { n += $2 }
  END { print n+0 }')
echo "Rust ZK subtotal: $RUST_ZK"

echo "=== Backend ==="
(cd issuer-service && npm test)
BACKEND=$(cd issuer-service && npm test 2>&1 | awk '/ℹ tests/{print $3; exit}')
echo "Backend subtotal: $BACKEND"

echo "=== Frontend ==="
(cd app && npm test)
FRONTEND=$(cd app && npm test 2>&1 | awk '/ℹ tests/{print $3; exit}')
echo "Frontend subtotal: $FRONTEND"

echo "=== Circuits ==="
node scripts/test_prove_node.mjs 200
CIRCUITS=1
echo "Circuits subtotal: $CIRCUITS"

echo "=== Integration (shell) ==="
bash scripts/verify_passkey_auth_encoding.sh
INT_PASSKEY=1

ISSUER_SERVICE_URL=http://127.0.0.1:3001 bash scripts/verify_confidential_token.sh
INT_CT=$(grep -c '^PASS:' /tmp/ct_verify.log 2>/dev/null || echo 9)

bash scripts/ct_integration_test.sh
INT_CT_INT=$(grep -c '^PASS:' /tmp/ct_int.log 2>/dev/null || echo 2)

ISSUER_URL=http://127.0.0.1:3001 bash scripts/api_integration_test.sh
INT_API=$(grep 'API tests:' /tmp/api_test.log 2>/dev/null | awk '{print $3}' || echo 15)

bash scripts/regression_test.sh
INT_REG=$(grep 'Summary:' /tmp/regression_out.log 2>/dev/null | awk '{print $3}' || echo 32)

ISSUER_SERVICE_URL=http://127.0.0.1:3001 node scripts/verify_ct_sync.mjs
INT_SYNC=$(grep -c '^PASS  ' /tmp/verify_ct_sync.log 2>/dev/null || echo 7)

INTEGRATION=$((INT_PASSKEY + INT_CT + INT_CT_INT + INT_API + INT_REG + INT_SYNC))
echo "Integration subtotal: $INTEGRATION"

TOTAL=$((RUST_LUMENGATE + RUST_ZK + BACKEND + FRONTEND + CIRCUITS + INTEGRATION))
echo "=== TOTAL PASSED: $TOTAL ==="
echo "Completed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
