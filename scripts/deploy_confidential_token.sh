#!/usr/bin/env bash
# Deploy Lumengate Confidential Token stack on testnet.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"
WASM="$ROOT/target/wasm32v1-none/release"
VK_DIR="$ROOT/circuits/confidential/vks"
if [[ ! -f "$VK_DIR/register.vk.bin" ]]; then
  VK_DIR="$ROOT/vendor/stellar-contracts/packages/tokens/src/confidential/circuits/vks"
fi

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r'; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
POLICY_ID=$(get_env POLICY_ID)
POLICY_VERIFIER=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
SESSION_STORE=$(node -e "console.log(require('$ROOT/deployments.json').session_store)")
ADAPTER=$(node -e "console.log(require('$ROOT/deployments.json').rwa_adapter)")
UNDERLYING=$(node -e "console.log(require('$ROOT/deployments.json').eurc_sac||require('$ROOT/deployments.json').native_sac)")

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/ct_deploy_last.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/ct_deploy_last.log | tail -1
}

echo "=== Build CT contracts ==="
for pkg in confidential-verifier confidential-auditor lumengate-confidential-policy lumengate-confidential-token; do
  stellar contract build --package "$pkg" --optimize >/dev/null
done

echo "=== Deploy CT verifier ==="
CT_VERIFIER=$(deploy "$WASM/confidential_verifier.wasm" --admin "$ADMIN" --manager "$ADMIN")
echo "CT Verifier: $CT_VERIFIER"

echo "=== Deploy CT auditor ==="
CT_AUDITOR=$(deploy "$WASM/confidential_auditor.wasm" --admin "$ADMIN" --manager "$ADMIN")
echo "CT Auditor: $CT_AUDITOR"

echo "=== Deploy CT policy hook ==="
CT_POLICY=$(deploy "$WASM/lumengate_confidential_policy.wasm" --admin "$ADMIN" --session_store "$SESSION_STORE" --policy_verifier "$POLICY_VERIFIER" --policy_id "$POLICY_ID")
echo "CT Policy: $CT_POLICY"

echo "=== Deploy CT token wrapper ==="
CT_TOKEN=$(deploy "$WASM/lumengate_confidential_token.wasm" --admin "$ADMIN" --underlying_asset "$UNDERLYING" --verifier "$CT_VERIFIER" --auditor "$CT_AUDITOR" --policy "$CT_POLICY")
echo "CT Token: $CT_TOKEN"

register_vk() {
  local name=$1
  local circuit=$2
  local vk_file="$VK_DIR/${name}.vk.bin"
  if [[ ! -f "$vk_file" ]]; then
    echo "Missing VK: $vk_file" >&2
    exit 1
  fi
  stellar contract invoke --id "$CT_VERIFIER" --source-account admin --network testnet --send yes -- \
    register_verification_key --circuit_type "$circuit" --vk-file-path "$vk_file" --operator "$ADMIN"
  echo "  registered VK $name (circuit $circuit)"
}

echo "=== Register six CT verification keys ==="
register_vk register 0
register_vk withdraw 1
register_vk transfer 2
register_vk spender_transfer 3
register_vk set_spender 4
register_vk revoke_spender 5

echo "=== Register auditor key id 1 ==="
AUDITOR_SK=$(node -e "
const { randomBytes } = require('crypto');
const sk = randomBytes(32);
console.log(sk.toString('hex'));
")
# Grumpkin public key from demo crypto — use node script after SDK port
AUDITOR_POINT=$(python3 -c "
import re
text=open('$ROOT/vendor/stellar-contracts/packages/tokens/src/confidential/test.rs').read()
m=re.search(r'const GRUMPKIN_G_BYTES: \[u8; 64\] = \[(.*?)\];', text, re.S)
bytes_list=[int(x,16) for x in re.findall(r'0x([0-9a-fA-F]+)', m.group(1))]
print(bytes(bytes_list).hex())
")
stellar contract invoke --id "$CT_AUDITOR" --source-account admin --network testnet --send yes -- \
  register_key --auditor_id 1 --point "$AUDITOR_POINT" --operator "$ADMIN"

LEDGER=$(stellar ledger --network testnet 2>/dev/null | rg -o '[0-9]+' | head -1 || echo "0")

node -e "
const fs=require('fs');
const p='$ROOT/deployments.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
d.confidential_token={
  verifier:'$CT_VERIFIER',
  auditor:'$CT_AUDITOR',
  policy:'$CT_POLICY',
  token:'$CT_TOKEN',
  underlying:'$UNDERLYING',
  deployed_at_ledger:Number('$LEDGER'),
  auditor_id:1
};
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
console.log('Updated deployments.json');
"

echo "=== CT deployment complete ==="
echo "Token: $CT_TOKEN"
echo "Verifier: $CT_VERIFIER"
echo "Auditor: $CT_AUDITOR"
echo "Policy: $CT_POLICY"
