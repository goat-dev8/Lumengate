#!/usr/bin/env bash
# Deploy external UltraHonkVerifierContract instances (VK-at-deploy) for each policy circuit.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"
UH_WASM="$ROOT/vendor/rs-soroban-ultrahonk/target/wasm32v1-none/release/rs_soroban_ultrahonk.wasm"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'; }

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Build external UltraHonk verifier WASM ==="
(cd "$ROOT/vendor/rs-soroban-ultrahonk/contracts/rs-soroban-ultrahonk" && stellar contract build --optimize >/dev/null)

deploy_verifier() {
  local vk_path=$1
  stellar contract deploy \
    --wasm "$UH_WASM" \
    --source-account deployer \
    --network testnet \
    -- \
    --vk_bytes-file-path "$vk_path" 2>&1 | tee /tmp/deploy_uh.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_uh.log | tail -1
}

ELIG_VK="$ROOT/circuits/lumengate/target/vk"
POF_VK="$ROOT/circuits/proof_of_funds/target/vk"

if [[ ! -f "$ELIG_VK" ]]; then
  WALLET_FIELD="${WALLET_FIELD:-200}" node "$ROOT/scripts/generate_prover_toml.js"
  bash "$ROOT/scripts/build_circuit.sh"
fi
if [[ ! -f "$POF_VK" ]]; then
  WALLET_FIELD="${WALLET_FIELD:-200}" RWA_BALANCE=990 POF_THRESHOLD=50 node "$ROOT/scripts/generate_pof_prover_toml.js"
  bash "$ROOT/scripts/build_pof_circuit.sh"
fi

echo "=== Deploy eligibility UltraHonk verifier ==="
ELIG_UH=$(deploy_verifier "$ELIG_VK")
echo "Eligibility UltraHonk: $ELIG_UH"

echo "=== Deploy PoF UltraHonk verifier ==="
POF_UH=$(deploy_verifier "$POF_VK")
echo "PoF UltraHonk: $POF_UH"

node -e "
const fs=require('fs');
const p='$ROOT/deployments.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.ultrahonk_verifier_eligibility='$ELIG_UH';
d.ultrahonk_verifier_pof='$POF_UH';
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
"

echo "External verifiers deployed and recorded in deployments.json"
