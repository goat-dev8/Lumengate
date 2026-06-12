#!/usr/bin/env bash
# Freighter wallet: credential → proof → ComplianceSacAdmin USDC settlement (testnet).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '\r\n'; }

FREIGHTER=$(get_env FREIGHTER_PUBLIC_KEY)
FREIGHTER_SECRET="${FREIGHTER_SECRET:-$(get_env FREIGHTER_SECRET 2>/dev/null || true)}"
TREASURY=$(get_env VITE_MARKETPLACE_SETTLEMENT_ADDRESS)
SAC_ADMIN=$(get_env COMPLIANCE_SAC_ADMIN_ID)
USDC_SAC=$(get_env VITE_USDC_SAC_ID)
AMOUNT="${SETTLE_AMOUNT:-10000000}"
ISSUER="${ISSUER_SERVICE_URL:-http://127.0.0.1:3001}"
WALLET_FIELD=$(node -e "
const crypto=require('crypto');
const g=process.argv[1];
const h=crypto.createHash('sha256').update(g).digest('hex').slice(0,14);
console.log(BigInt('0x'+h).toString());
" "$FREIGHTER")

echo "=== Freighter USDC E2E ==="
echo "wallet: $FREIGHTER"
echo "walletField: $WALLET_FIELD"
echo "treasury: $TREASURY"
echo "sac_admin: $SAC_ADMIN"
echo "amount_stroops: $AMOUNT (1 USDC default)"

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== BEFORE balances ==="
bash "$ROOT/scripts/snapshot_balances.sh"

echo "=== Issuer credential (walletField=$WALLET_FIELD) ==="
curl -sf "$ISSUER/health" >/dev/null || { echo "Issuer down at $ISSUER"; exit 1; }
curl -sf -X POST "$ISSUER/credential" \
  -H 'Content-Type: application/json' \
  -d "{\"walletField\":\"$WALLET_FIELD\",\"policyKey\":\"general-eligibility\"}" \
  > /tmp/freighter_cred.json
node "$ROOT/scripts/write_prover_from_credential.mjs" /tmp/freighter_cred.json

echo "=== Build ZK proof ==="
bash "$ROOT/scripts/build_circuit.sh"
PROOF_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
PI_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')

echo "=== Simulate transfer_compliant (auth root) ==="
stellar contract invoke --id "$SAC_ADMIN" --source-account "$FREIGHTER" --network testnet \
  --send no --auth-mode root -- \
  transfer_compliant --from "$FREIGHTER" --to "$TREASURY" --amount "$AMOUNT" \
  --proof "$PROOF_HEX" --public_inputs "$PI_HEX" 2>&1 | tee /tmp/freighter_sim.log

if [[ -z "$FREIGHTER_SECRET" ]]; then
  echo "ERROR: FREIGHTER_SECRET not set — cannot sign from.require_auth() for $FREIGHTER"
  echo "Add FREIGHTER_SECRET to .env (export from Freighter Settings → Show secret key) and re-run."
  exit 2
fi

printf '%s' "$FREIGHTER_SECRET" | stellar keys add freighter --secret-key --overwrite 2>/dev/null || true

echo "=== Submit transfer_compliant (Freighter signed) ==="
stellar contract invoke --id "$SAC_ADMIN" --source-account freighter --network testnet --send yes \
  --sign-with-key freighter --auto-sign -- \
  transfer_compliant --from "$FREIGHTER" --to "$TREASURY" --amount "$AMOUNT" \
  --proof "$PROOF_HEX" --public_inputs "$PI_HEX" 2>&1 | tee /tmp/freighter_settle.log

SETTLE_TX=$(grep -oE '[a-f0-9]{64}' /tmp/freighter_settle.log | head -1 || true)
echo "settle_tx=$SETTLE_TX"
echo "explorer=https://stellar.expert/explorer/testnet/tx/$SETTLE_TX"

echo "=== Verify UsdcTransferGated event ==="
bash "$ROOT/scripts/verify-tx-events.sh" "$SETTLE_TX" | tee /tmp/freighter_events.log

echo "=== AFTER balances ==="
bash "$ROOT/scripts/snapshot_balances.sh"

echo "=== Regression ==="
WALLET_FIELD="$WALLET_FIELD" bash "$ROOT/scripts/regression_test.sh"

echo "=== API integration ==="
bash "$ROOT/scripts/api_integration_test.sh"

echo "=== E2E COMPLETE tx=$SETTLE_TX ==="
