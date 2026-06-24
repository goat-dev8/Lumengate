#!/usr/bin/env bash
# Deploy AccessControl-hardened PolicyVerifier + CredentialRegistry (Phase 0).
# After run: update deployments.json, re-register VKs, migrate roots, point adapter.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"
WASM="$ROOT/target/wasm32v1-none/release"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
POLICY_ID=$(get_env POLICY_ID)
POLICY_ID_2=$(get_env POLICY_ID_2)
IR=$(node -e "console.log(require('$ROOT/deployments.json').issuer_registry)")
OLD_CR=$(node -e "console.log(require('$ROOT/deployments.json').credential_registry)")
OLD_PV=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
OLD_ADAPTER=$(node -e "console.log(require('$ROOT/deployments.json').rwa_adapter)")

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Build hardened contracts ==="
for d in policy_verifier credential_registry; do
  (cd "$ROOT/contracts/$d" && stellar contract build --optimize >/dev/null)
done

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/deploy_hardened.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_hardened.log | tail -1
}

echo "=== Deploy CredentialRegistry (AccessControl) ==="
NEW_CR=$(deploy "$WASM/credential_registry.wasm" --admin "$ADMIN" --issuer_registry "$IR")
echo "CredentialRegistry: $NEW_CR"

echo "=== Deploy PolicyVerifier (AccessControl) ==="
NEW_PV=$(deploy "$WASM/policy_verifier.wasm" --admin "$ADMIN")
echo "PolicyVerifier: $NEW_PV"

echo "=== Copy roots from legacy registry ==="
ROOTS=$(stellar contract invoke --id "$OLD_CR" --source-account deployer --network testnet -- get_roots 2>&1 | tail -1)
MERKLE=$(echo "$ROOTS" | node -e "const l=require('fs').readFileSync(0,'utf8'); const m=l.match(/\"([0-9a-f]{64})\"/g); console.log(m[0].replace(/\"/g,''));")
REV=$(echo "$ROOTS" | node -e "const l=require('fs').readFileSync(0,'utf8'); const m=l.match(/\"([0-9a-f]{64})\"/g); console.log(m[1].replace(/\"/g,''));")

stellar contract invoke --id "$NEW_CR" --source-account admin --network testnet --send yes -- \
  set_root --caller "$ADMIN" --root "$MERKLE"
stellar contract invoke --id "$NEW_CR" --source-account admin --network testnet --send yes -- \
  set_revocation_root --caller "$ADMIN" --revocation_root "$REV"

echo "=== Register VKs on new PolicyVerifier ==="
bash "$ROOT/scripts/register_vk_v3.sh" 2>&1 | sed "s|$OLD_PV|$NEW_PV|g" || true
ELIG_VK="$ROOT/circuits/lumengate/target/vk"
POF_VK="$ROOT/circuits/proof_of_funds/target/vk"
WALLET_FIELD="${WALLET_FIELD:-200}" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
WALLET_FIELD="${WALLET_FIELD:-200}" RWA_BALANCE=990 POF_THRESHOLD=50 node "$ROOT/scripts/generate_pof_prover_toml.js"
bash "$ROOT/scripts/build_pof_circuit.sh"

stellar contract invoke --id "$NEW_PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID" --vk-file-path "$ELIG_VK"
stellar contract invoke --id "$NEW_PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID_2" --vk-file-path "$POF_VK"

echo "=== Point RwaAdapter at new PolicyVerifier ==="
stellar contract invoke --id "$OLD_ADAPTER" --source-account admin --network testnet --send yes -- \
  set_verifier --admin "$ADMIN" --verifier "$NEW_PV" 2>/dev/null || \
stellar contract invoke --id "$OLD_ADAPTER" --source-account admin --network testnet --send yes -- \
  set_verifier --caller "$ADMIN" --verifier "$NEW_PV" 2>/dev/null || echo "WARN: set_verifier failed — adapter may need redeploy"

node -e "
const fs=require('fs');
const p='$ROOT/deployments.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.policy_verifier='$NEW_PV';
d.credential_registry='$NEW_CR';
d.transactions=d.transactions||{};
d.transactions.phase0_hardened_pv=process.env.PV_TX||'';
d.transactions.phase0_hardened_cr=process.env.CR_TX||'';
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
console.log('Updated deployments.json');
"

echo "=== Phase 0 partial deploy complete ==="
echo "PolicyVerifier: $NEW_PV"
echo "CredentialRegistry: $NEW_CR"
echo "Next: update .env VITE_* IDs, run regression_test.sh"
