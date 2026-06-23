#!/usr/bin/env bash
# Complete deploy after RwaToken/RwaAdapter already deployed — mint + adapter test + update env.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2-; }

RWA="${RWA:-CB6PFMGCUDVTNCK44MKIRJRCRRW66QDBPVTMIQVT4UDUVRB5UA6ADQOB}"
ADAPTER="${ADAPTER:-CDY7GLNDVQPMGLLD5HDRNU6IDANNK5OUIJQDK3F66KCGHJ4RIML5A4L4}"
PV=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
POLICY_ID=$(get_env POLICY_ID)
POLICY_ID_2="${POLICY_ID_2:-2}"
ELIGIBLE=$(get_env ELIGIBLE_WALLET_PUBLIC_KEY)
ELIGIBLE_SECRET=$(get_env ELIGIBLE_WALLET_SECRET)

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$ELIGIBLE_SECRET" | stellar keys add eligible --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Mint RWA to eligible wallet ==="
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

echo "=== Test RwaAdapter.is_eligible ==="
WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
ADAPT_PROOF_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
ADAPT_PI_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')

stellar contract invoke --id "$ADAPTER" --source-account deployer --network testnet -- \
  is_eligible --policy_id "$POLICY_ID" --proof "$ADAPT_PROOF_HEX" --public_inputs "$ADAPT_PI_HEX" 2>&1 | tee /tmp/adapter_test.log

echo "=== Update deployments.json and env ==="
node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('$ROOT/deployments.json','utf8'));
d.rwa_token='$RWA';
d.rwa_adapter='$ADAPTER';
d.policy_id_2=Number('$POLICY_ID_2');
d.transactions=d.transactions||{};
d.transactions.pof_verify='5d4d7a6e6a0abbb23563dd9dc9d0da7b6633814d05c1d1ee1f5188f415a04e32';
d.transactions.policy_2_registered='81ac6bb8b47ebbba43c50887ea3f7d2b0f0c480ade572a5edd98c0e3747886a5';
d.transactions.rwa_mint='$MINT_TX';
fs.writeFileSync('$ROOT/deployments.json', JSON.stringify(d,null,2));
console.log(JSON.stringify({rwa_token:'$RWA', rwa_adapter:'$ADAPTER', mint:'$MINT_TX'},null,2));
"

for var in RWA_TOKEN_ID RWA_ADAPTER_ID VITE_RWA_TOKEN_ID VITE_RWA_ADAPTER_ID VITE_POLICY_ID_2 POLICY_ID_2; do
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

for f in development production; do
  ENV_FILE="$ROOT/app/.env.$f"
  sed -i "/^VITE_RWA_TOKEN_ID=/d" "$ENV_FILE"
  sed -i "/^VITE_RWA_ADAPTER_ID=/d" "$ENV_FILE"
  sed -i "/^VITE_POLICY_ID_2=/d" "$ENV_FILE"
  echo "VITE_RWA_TOKEN_ID=$RWA" >> "$ENV_FILE"
  echo "VITE_RWA_ADAPTER_ID=$ADAPTER" >> "$ENV_FILE"
  echo "VITE_POLICY_ID_2=$POLICY_ID_2" >> "$ENV_FILE"
done

echo "DONE mint=$MINT_TX"
