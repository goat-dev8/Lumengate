#!/usr/bin/env bash
# Upgrade PolicyVerifier (validate entrypoint) + CT policy hook (direct PV validate, ignores spent nullifiers).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"
WASM="$ROOT/target/wasm32v1-none/release"

get_env() {
  grep "^$1=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//' || true
}

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
POLICY_ID=$(get_env POLICY_ID)
POLICY_ID_2=$(get_env POLICY_ID_2)
SESSION_STORE=$(node -e "console.log(require('$ROOT/deployments.json').session_store)")
CT_TOKEN=$(node -e "console.log(require('$ROOT/deployments.json').confidential_token.token)")
ELIG_UH=$(node -e "console.log(require('$ROOT/deployments.json').ultrahonk_verifier_eligibility)")
POF_UH=$(node -e "console.log(require('$ROOT/deployments.json').ultrahonk_verifier_pof)")

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/ct_upgrade_last.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/ct_upgrade_last.log | tail -1
}

echo "=== Build policy_verifier + lumengate_confidential_policy ==="
for pkg in policy-verifier lumengate-confidential-policy; do
  stellar contract build --package "$pkg" --optimize >/dev/null
done

echo "=== Deploy PolicyVerifier with validate() ==="
NEW_PV=$(deploy "$WASM/policy_verifier.wasm" --admin "$ADMIN")
echo "PolicyVerifier: $NEW_PV"

stellar contract invoke --id "$NEW_PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID" --verifier "$ELIG_UH"
stellar contract invoke --id "$NEW_PV" --source-account admin --network testnet --send yes -- \
  register_policy --caller "$ADMIN" --policy_id "$POLICY_ID_2" --verifier "$POF_UH"

echo "=== Deploy CT policy (session_store + policy_verifier.validate) ==="
NEW_CT_POLICY=$(deploy "$WASM/lumengate_confidential_policy.wasm" \
  --admin "$ADMIN" --session_store "$SESSION_STORE" --policy_verifier "$NEW_PV" --policy_id "$POLICY_ID")
echo "CT Policy: $NEW_CT_POLICY"

echo "=== Point CT token compliance config at new policy ==="
stellar contract invoke --id "$CT_TOKEN" --source-account admin --network testnet --send yes -- \
  set_compliance_config --admin "$ADMIN" --config '{"policy":"'"$NEW_CT_POLICY"'","sac_passthrough":true}'

LEDGER=$(stellar ledger --network testnet 2>/dev/null | rg -o '[0-9]+' | head -1 || echo "0")

node -e "
const fs=require('fs');
const p='$ROOT/deployments.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.policy_verifier=d.policy_verifier;
d.confidential_token=d.confidential_token||{};
d.confidential_token.policy='$NEW_CT_POLICY';
d.confidential_token.policy_verifier='$NEW_PV';
d.confidential_token.policy_upgraded_at_ledger=Number('$LEDGER');
d.transactions=d.transactions||{};
d.transactions.ct_policy_validate_upgrade='upgrade_ct_policy_validate.sh';
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
console.log('Updated deployments.json');
"

echo "=== CT policy validate upgrade complete ==="
echo "PolicyVerifier: $NEW_PV"
echo "CT Policy: $NEW_CT_POLICY"
echo "CT Token: $CT_TOKEN (compliance policy updated)"
