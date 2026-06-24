#!/usr/bin/env bash
# Deploy external-verifier PolicyVerifier + hardened RwaAdapter + ComplianceSacAdmin.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"
WASM="$ROOT/target/wasm32v1-none/release"

get_env() {
  local val
  val=$(grep "^$1=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//' || true)
  echo "$val"
}

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
POLICY_ID=$(get_env POLICY_ID)
POLICY_ID_2=$(get_env POLICY_ID_2)
PV_OLD=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
ADAPTER_OLD=$(node -e "console.log(require('$ROOT/deployments.json').rwa_adapter)")
SAC_OLD=$(node -e "console.log(require('$ROOT/deployments.json').compliance_sac_admin)")
USDC=$(get_env USDC_SAC_CONTRACT_ID)
[[ -z "$USDC" ]] && USDC=$(get_env VITE_USDC_SAC_ID)
EURC=$(get_env EURC_SAC_CONTRACT_ID)
[[ -z "$EURC" ]] && EURC=$(get_env VITE_EURC_SAC_ID)
if [[ -z "$USDC" || -z "$EURC" ]]; then
  echo "USDC/EURC SAC IDs missing in .env" >&2
  exit 1
fi

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Deploy external UltraHonk verifier contracts ==="
bash "$ROOT/scripts/deploy_external_verifiers.sh"
ELIG_UH=$(node -e "console.log(require('$ROOT/deployments.json').ultrahonk_verifier_eligibility)")
POF_UH=$(node -e "console.log(require('$ROOT/deployments.json').ultrahonk_verifier_pof)")

echo "=== Build hardened contracts ==="
for d in policy_verifier rwa_adapter compliance_sac_admin; do
  (cd "$ROOT/contracts/$d" && stellar contract build --optimize >/dev/null)
done

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/deploy_h.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_h.log | tail -1
}

echo "=== Deploy PolicyVerifier (external verifier routing) ==="
NEW_PV=$(deploy "$WASM/policy_verifier.wasm" --admin "$ADMIN")
echo "PolicyVerifier: $NEW_PV"

stellar contract invoke --id "$NEW_PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID" --verifier "$ELIG_UH"
stellar contract invoke --id "$NEW_PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID_2" --verifier "$POF_UH"

echo "=== Deploy RwaAdapter (AccessControl) ==="
NEW_ADAPTER=$(deploy "$WASM/rwa_adapter.wasm" --admin "$ADMIN" --verifier "$NEW_PV")
echo "RwaAdapter: $NEW_ADAPTER"

echo "=== Deploy ComplianceSacAdmin (AccessControl) ==="
NEW_SAC=$(deploy "$WASM/compliance_sac_admin.wasm" --admin "$ADMIN" --adapter "$NEW_ADAPTER" --usdc_sac "$USDC" --eurc_sac "$EURC" --policy_id "$POLICY_ID")
echo "ComplianceSacAdmin: $NEW_SAC"

echo "=== Point CompliantDEX/Payroll at new adapter (if set_verifier exists on legacy) ==="
for id in compliant_dex compliant_payroll; do
  CID=$(node -e "console.log(require('$ROOT/deployments.json').$id || '')")
  if [[ -n "$CID" && "$CID" != "undefined" ]]; then
    stellar contract invoke --id "$CID" --source-account admin --network testnet --send yes -- \
      set_adapter --admin "$ADMIN" --adapter "$NEW_ADAPTER" 2>/dev/null || \
    stellar contract invoke --id "$CID" --source-account admin --network testnet --send yes -- \
      set_adapter --caller "$ADMIN" --adapter "$NEW_ADAPTER" 2>/dev/null || \
    echo "WARN: could not repoint $id — may need redeploy"
  fi
done

echo "=== Verify eligibility proof via new PolicyVerifier ==="
stellar contract invoke --id "$NEW_PV" --source-account admin --network testnet --send yes -- \
  verify --policy_id "$POLICY_ID" \
  --proof-file-path "$ROOT/circuits/lumengate/target/proof" \
  --public_inputs-file-path "$ROOT/circuits/lumengate/target/public_inputs"

node -e "
const fs=require('fs');
const p='$ROOT/deployments.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.policy_verifier='$NEW_PV';
d.rwa_adapter='$NEW_ADAPTER';
d.compliance_sac_admin='$NEW_SAC';
d.transactions=d.transactions||{};
d.transactions.external_pv='$NEW_PV';
d.transactions.external_adapter='$NEW_ADAPTER';
d.transactions.external_sac='$NEW_SAC';
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
"

# Patch .env contract IDs
for pair in POLICY_VERIFIER_ID:$NEW_PV RWA_ADAPTER_ID:$NEW_ADAPTER COMPLIANCE_SAC_ADMIN_ID:$NEW_SAC VITE_POLICY_VERIFIER_ID:$NEW_PV VITE_RWA_ADAPTER_ID:$NEW_ADAPTER VITE_COMPLIANCE_SAC_ADMIN_ID:$NEW_SAC; do
  KEY=${pair%%:*}; VAL=${pair#*:}
  if grep -q "^$KEY=" "$ROOT/.env"; then
    sed -i "s|^$KEY=.*|$KEY=$VAL|" "$ROOT/.env"
  else
    echo "$KEY=$VAL" >> "$ROOT/.env"
  fi
done

echo "=== Hardened external-verifier deploy complete ==="
echo "PolicyVerifier: $NEW_PV"
echo "RwaAdapter: $NEW_ADAPTER"
echo "ComplianceSacAdmin: $NEW_SAC"
