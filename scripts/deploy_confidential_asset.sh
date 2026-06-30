#!/usr/bin/env bash
# Deploy a Lumengate Confidential Token stack for EURC or USDC underlying SAC.
# Usage: bash scripts/deploy_confidential_asset.sh usdc
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSET="${1:-eurc}"
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

if [[ "$ASSET" == "usdc" ]]; then
  UNDERLYING=$(node -e "
    const d=require('$ROOT/deployments.json');
    console.log(d.usdc_sac||process.env.VITE_USDC_SAC_ID||'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA');
  ")
elif [[ "$ASSET" == "eurc" ]]; then
  UNDERLYING=$(node -e "console.log(require('$ROOT/deployments.json').eurc_sac||require('$ROOT/deployments.json').native_sac)")
else
  echo "Unknown asset: $ASSET (use eurc or usdc)" >&2
  exit 1
fi

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
# Shell env may set STELLAR_NETWORK_PASSPHRASE=Test (wrong); always use testnet config.
export STELLAR_NETWORK=testnet
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar network use testnet

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/ct_deploy_last.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/ct_deploy_last.log | tail -1
}

echo "=== Build CT contracts ($ASSET) ==="
for pkg in confidential-verifier confidential-auditor lumengate-confidential-policy lumengate-confidential-token; do
  stellar contract build --package "$pkg" --optimize >/dev/null
done

echo "=== Deploy CT verifier ($ASSET) ==="
CT_VERIFIER=$(deploy "$WASM/confidential_verifier.wasm" --admin "$ADMIN" --manager "$ADMIN")
echo "CT Verifier: $CT_VERIFIER"

echo "=== Deploy CT auditor ($ASSET) ==="
CT_AUDITOR=$(deploy "$WASM/confidential_auditor.wasm" --admin "$ADMIN" --manager "$ADMIN")
echo "CT Auditor: $CT_AUDITOR"

echo "=== Deploy CT policy hook ($ASSET) ==="
CT_POLICY=$(deploy "$WASM/lumengate_confidential_policy.wasm" --admin "$ADMIN" --session_store "$SESSION_STORE" --policy_verifier "$POLICY_VERIFIER" --policy_id "$POLICY_ID")
echo "CT Policy: $CT_POLICY"

echo "=== Deploy CT token wrapper ($ASSET, underlying $UNDERLYING) ==="
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

echo "=== Register six CT verification keys ($ASSET) ==="
register_vk register 0
register_vk withdraw 1
register_vk transfer 2
register_vk spender_transfer 3
register_vk set_spender 4
register_vk revoke_spender 5

echo "=== Register auditor key id 1 ($ASSET) ==="
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
const app='$ROOT/app/deployments.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
const stack={
  verifier:'$CT_VERIFIER',
  auditor:'$CT_AUDITOR',
  policy:'$CT_POLICY',
  token:'$CT_TOKEN',
  underlying:'$UNDERLYING',
  deployed_at_ledger:Number('$LEDGER'),
  auditor_id:1,
  auditor_secret_hex:d.confidential_token?.auditor_secret_hex||'0000000000000000000000000000000000000000000000000000000000000001',
};
d.confidential_tokens=d.confidential_tokens||{};
d.confidential_tokens['$ASSET']=stack;
if ('$ASSET'==='eurc') d.confidential_token=stack;
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
fs.copyFileSync(p, app);
console.log(JSON.stringify(stack,null,2));
"

echo "=== CT deployment complete ($ASSET) ==="
