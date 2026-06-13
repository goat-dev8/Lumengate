#!/usr/bin/env bash
# Re-register eligibility + PoF policies on external-verifier PolicyVerifier (V3 Ed25519 circuit).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
POLICY_ID=$(get_env POLICY_ID)
POLICY_ID_2=$(get_env POLICY_ID_2)
PV=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")

printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Build circuits ==="
WALLET_FIELD="${WALLET_FIELD:-200}" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
WALLET_FIELD="${WALLET_FIELD:-200}" RWA_BALANCE=990 POF_THRESHOLD=50 node "$ROOT/scripts/generate_pof_prover_toml.js"
bash "$ROOT/scripts/build_pof_circuit.sh"

echo "=== Deploy external UltraHonk verifier contracts ==="
bash "$ROOT/scripts/deploy_external_verifiers.sh"
ELIG_UH=$(node -e "console.log(require('$ROOT/deployments.json').ultrahonk_verifier_eligibility)")
POF_UH=$(node -e "console.log(require('$ROOT/deployments.json').ultrahonk_verifier_pof)")

echo "=== Register policy $POLICY_ID → $ELIG_UH ==="
stellar contract invoke --id "$PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID" --verifier "$ELIG_UH"

echo "=== Register policy $POLICY_ID_2 → $POF_UH ==="
stellar contract invoke --id "$PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID_2" --verifier "$POF_UH"

echo "=== Verify sample eligibility proof on-chain ==="
stellar contract invoke --id "$PV" --source-account admin --network testnet --send yes -- \
  verify --policy_id "$POLICY_ID" \
  --proof-file-path "$ROOT/circuits/lumengate/target/proof" \
  --public_inputs-file-path "$ROOT/circuits/lumengate/target/public_inputs"

echo "External verifier registration complete for PolicyVerifier $PV"
