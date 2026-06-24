#!/usr/bin/env bash
# Incremental deploy: updated RwaToken, RwaAdapter, register policy_id 2 (PoF).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2-; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
PV=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
POLICY_ID=$(get_env POLICY_ID)
POLICY_ID_2="${POLICY_ID_2:-2}"
ELIGIBLE=$(get_env ELIGIBLE_WALLET_PUBLIC_KEY)
ELIGIBLE_SECRET=$(get_env ELIGIBLE_WALLET_SECRET)

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
printf '%s' "$ELIGIBLE_SECRET" | stellar keys add eligible --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

WASM="$ROOT/target/wasm32v1-none/release"
POF_VK="$ROOT/circuits/proof_of_funds/target/vk"
POF_PROOF="$ROOT/circuits/proof_of_funds/target/proof"
POF_PI="$ROOT/circuits/proof_of_funds/target/public_inputs"

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/deploy_last.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_last.log | tail -1
}

echo "=== Build contracts ==="
(cd "$ROOT/contracts/rwa_token" && stellar contract build --optimize >/dev/null)
(cd "$ROOT/contracts/rwa_adapter" && stellar contract build --optimize >/dev/null)

echo "=== Build proof-of-funds circuit ==="
bash "$ROOT/scripts/build_pof_circuit.sh"

echo "=== Register policy_id $POLICY_ID_2 (PoF VK) ==="
stellar contract invoke --id "$PV" --source-account admin --network testnet --send yes -- \
  register_policy --admin "$ADMIN" --policy_id "$POLICY_ID_2" --vk-file-path "$POF_VK" 2>&1 | tee /tmp/register_pof.log

echo "=== Verify PoF proof on-chain ==="
stellar contract invoke --id "$PV" --source-account deployer --network testnet --send yes -- \
  verify --policy_id "$POLICY_ID_2" --proof-file-path "$POF_PROOF" --public_inputs-file-path "$POF_PI" 2>&1 | tee /tmp/pof_verify.log

POF_VERIFY_TX=$(grep -oE '[a-f0-9]{64}' /tmp/pof_verify.log | head -1 || true)

echo "=== Deploy updated RwaToken ==="
RWA=$(deploy "$WASM/rwa_token.wasm" --admin "$ADMIN" --verifier "$PV" --policy_id "$POLICY_ID")
echo "RwaToken: $RWA"

echo "=== Deploy RwaAdapter ==="
ADAPTER=$(deploy "$WASM/rwa_adapter.wasm" --admin "$ADMIN" --verifier "$PV")
echo "RwaAdapter: $ADAPTER"

echo "=== Seed eligible wallet balance (mint with eligibility proof) ==="
WALLET_FIELD="${WALLET_FIELD:-200}"
WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
ELIG_PROOF="$ROOT/circuits/lumengate/target/proof"
ELIG_PI="$ROOT/circuits/lumengate/target/public_inputs"
ELIG_PROOF_HEX=$(xxd -p "$ELIG_PROOF" | tr -d '\n')
ELIG_PI_HEX=$(xxd -p "$ELIG_PI" | tr -d '\n')

stellar contract invoke --id "$RWA" --source-account eligible --network testnet --send yes -- \
  mint --to "$ELIGIBLE" --amount 1000 \
  --proof "$ELIG_PROOF_HEX" --public_inputs "$ELIG_PI_HEX" 2>&1 | tee /tmp/mint_tx.log

MINT_TX=$(grep -oE '[a-f0-9]{64}' /tmp/mint_tx.log | head -1 || true)

echo "=== Test RwaAdapter.is_eligible (fresh eligibility proof) ==="
WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
ADAPT_PROOF_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
ADAPT_PI_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')

stellar contract invoke --id "$ADAPTER" --source-account deployer --network testnet -- \
  is_eligible --policy_id "$POLICY_ID" --proof "$ADAPT_PROOF_HEX" --public_inputs "$ADAPT_PI_HEX" 2>&1 | tee /tmp/adapter_test.log

echo "=== Update deployments.json and .env ==="
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('$ROOT/deployments.json','utf8'));
d.rwa_token='$RWA';
d.rwa_adapter='$ADAPTER';
d.policy_id_2=Number('$POLICY_ID_2');
d.transactions=d.transactions||{};
d.transactions.policy_2_registered='$(grep -oE '[a-f0-9]{64}' /tmp/register_pof.log | head -1 || echo '')';
d.transactions.pof_verify='$POF_VERIFY_TX';
d.transactions.rwa_mint='$MINT_TX';
fs.writeFileSync('$ROOT/deployments.json', JSON.stringify(d,null,2));
console.log(JSON.stringify({rwa_token:'$RWA', rwa_adapter:'$ADAPTER', pof_verify:'$POF_VERIFY_TX'},null,2));
"

for var in RWA_TOKEN_ID RWA_ADAPTER_ID VITE_RWA_TOKEN_ID VITE_RWA_ADAPTER_ID; do
  sed -i "/^${var}=/d" "$ROOT/.env"
done
cat >> "$ROOT/.env" <<EOF
RWA_TOKEN_ID=$RWA
RWA_ADAPTER_ID=$ADAPTER
POLICY_ID_2=$POLICY_ID_2
VITE_RWA_TOKEN_ID=$RWA
VITE_RWA_ADAPTER_ID=$ADAPTER
VITE_POLICY_ID_2=$POLICY_ID_2
EOF

# Update app env files
for f in development production; do
  ENV_FILE="$ROOT/app/.env.$f"
  sed -i "/^VITE_RWA_TOKEN_ID=/d" "$ENV_FILE"
  sed -i "/^VITE_RWA_ADAPTER_ID=/d" "$ENV_FILE"
  sed -i "/^VITE_POLICY_ID_2=/d" "$ENV_FILE"
  echo "VITE_RWA_TOKEN_ID=$RWA" >> "$ENV_FILE"
  echo "VITE_RWA_ADAPTER_ID=$ADAPTER" >> "$ENV_FILE"
  echo "VITE_POLICY_ID_2=$POLICY_ID_2" >> "$ENV_FILE"
done

echo "DONE — RwaToken=$RWA RwaAdapter=$ADAPTER PoF verify=$POF_VERIFY_TX"
