#!/usr/bin/env bash
# Phase 6 integration: prove off-chain, transfer on-chain with real BN254 verify.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2-; }

WALLET_FIELD="${WALLET_FIELD:-200}"
RWA=$(node -e "console.log(require('$ROOT/deployments.json').rwa_token)")
PV=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
CR=$(node -e "console.log(require('$ROOT/deployments.json').credential_registry)")
POLICY_ID=$(get_env POLICY_ID)
FROM=$(get_env ELIGIBLE_WALLET_PUBLIC_KEY)
TO=$(get_env FREIGHTER_PUBLIC_KEY)
FROM_SECRET=$(get_env ELIGIBLE_WALLET_SECRET)

printf '%s' "$FROM_SECRET" | stellar keys add eligible --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Generate Prover.toml (wallet field $WALLET_FIELD) ==="
WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"

echo "=== Compile + prove ==="
bash "$ROOT/scripts/build_circuit.sh"

PROOF="$ROOT/circuits/lumengate/target/proof"
PI="$ROOT/circuits/lumengate/target/public_inputs"
PROOF_HEX=$(xxd -p "$PROOF" | tr -d '\n')
PI_HEX=$(xxd -p "$PI" | tr -d '\n')

echo "=== Read on-chain roots ==="
ROOTS=$(stellar contract invoke --id "$CR" --source-account deployer --network testnet -- get_roots 2>&1)
echo "$ROOTS"

echo "=== Transfer with ZK proof (eligible -> freighter) ==="
stellar contract invoke --id "$RWA" --source-account eligible --network testnet --send yes -- \
  transfer --from "$FROM" --to "$TO" --amount 100 \
  --proof "$PROOF_HEX" --public_inputs "$PI_HEX" 2>&1 | tee /tmp/transfer_tx.log

TRANSFER_TX=$(grep -oE '[a-f0-9]{64}' /tmp/transfer_tx.log | head -1 || true)
echo "transfer_tx=$TRANSFER_TX"

echo "=== Balances ==="
stellar contract invoke --id "$RWA" --source-account deployer --network testnet -- balance --holder "$FROM" 2>&1 | tail -1
stellar contract invoke --id "$RWA" --source-account deployer --network testnet -- balance --holder "$TO" 2>&1 | tail -1

echo "=== is_frozen sanctioned ==="
stellar contract invoke --id "$RWA" --source-account deployer --network testnet -- \
  is_frozen --holder "$(get_env SANCTIONED_WALLET_PUBLIC_KEY)" 2>&1 | tail -1

node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('$ROOT/deployments.json','utf8'));
d.transactions=d.transactions||{};
d.transactions.transfer_gated='$TRANSFER_TX';
d.transactions.holder_frozen_new_rwa='9ecf813721dc32acfd941d44b9b91d59f18fad14902de173fab228aa7e2e67f6';
d.transactions.is_frozen_read='63c3d6476ac318b8b6f3cfa97c720d6313b0098e60a075bfd448fe1dbc6c5bf0';
d.integration={ wallet_field:'$WALLET_FIELD', from:'$FROM', to:'$TO', on_chain_roots:String(\`$ROOTS\`.replace(/\\n/g,' ')) };
fs.writeFileSync('$ROOT/deployments.json', JSON.stringify(d,null,2));
console.log('Updated deployments.json');
"
