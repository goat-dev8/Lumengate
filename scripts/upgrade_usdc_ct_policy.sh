#!/usr/bin/env bash
# Point USDC confidential token at a CT policy wired to PolicyVerifier.validate().
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"
WASM="$ROOT/target/wasm32v1-none/release"

get_env() {
  grep "^$1=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//' || true
}

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
POLICY_ID=$(get_env POLICY_ID)
SESSION_STORE=$(node -e "console.log(require('$ROOT/deployments.json').session_store)")
USDC_TOKEN=$(node -e "console.log(require('$ROOT/deployments.json').confidential_tokens.usdc.token)")
POLICY_VERIFIER=$(node -e "
  const d=require('$ROOT/deployments.json');
  console.log(d.confidential_token?.policy_verifier || d.policy_verifier);
")

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
export STELLAR_NETWORK=testnet
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar network use testnet

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/usdc_ct_policy_upgrade.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/usdc_ct_policy_upgrade.log | tail -1
}

echo "=== Build lumengate_confidential_policy ==="
stellar contract build --package lumengate-confidential-policy --optimize >/dev/null

echo "=== Deploy USDC CT policy (policy_verifier=$POLICY_VERIFIER) ==="
NEW_USDC_POLICY=$(deploy "$WASM/lumengate_confidential_policy.wasm" \
  --admin "$ADMIN" --session_store "$SESSION_STORE" --policy_verifier "$POLICY_VERIFIER" --policy_id "$POLICY_ID")
echo "USDC CT Policy: $NEW_USDC_POLICY"

echo "=== Point USDC CT token at new policy ==="
stellar contract invoke --id "$USDC_TOKEN" --source-account admin --network testnet --send yes -- \
  set_compliance_config --admin "$ADMIN" --config '{"policy":"'"$NEW_USDC_POLICY"'","sac_passthrough":true}'

LEDGER=$(stellar ledger --network testnet 2>/dev/null | rg -o '[0-9]+' | head -1 || echo "0")

node -e "
const fs=require('fs');
const p='$ROOT/deployments.json';
const app='$ROOT/app/deployments.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.confidential_tokens=d.confidential_tokens||{};
d.confidential_tokens.usdc=d.confidential_tokens.usdc||{};
d.confidential_tokens.usdc.policy='$NEW_USDC_POLICY';
d.confidential_tokens.usdc.policy_verifier='$POLICY_VERIFIER';
d.confidential_tokens.usdc.policy_upgraded_at_ledger=Number('$LEDGER');
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
fs.copyFileSync(p, app);
console.log(JSON.stringify(d.confidential_tokens.usdc,null,2));
"

echo "=== USDC CT policy upgrade complete ==="
