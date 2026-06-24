#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2-; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
POLICY_ID=$(get_env POLICY_ID)
ETH_PUB=$(get_env ISSUER_ETH_PUBKEY_BYTES64)
SANCTIONED=$(get_env SANCTIONED_WALLET_PUBLIC_KEY)

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

WASM="$ROOT/target/wasm32v1-none/release"
VK="$ROOT/circuits/lumengate/target/vk"
PROOF="$ROOT/circuits/lumengate/target/proof"
PI="$ROOT/circuits/lumengate/target/public_inputs"

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/deploy_last.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_last.log | tail -1
}

echo "Building contracts..."
for d in issuer_registry credential_registry policy_verifier rwa_token; do
  (cd "$ROOT/contracts/$d" && stellar contract build --optimize >/dev/null)
done

echo "=== Deploy IssuerRegistry ==="
IR=$(deploy "$WASM/issuer_registry.wasm" --admin "$ADMIN")
echo "IssuerRegistry: $IR"

echo "=== Deploy CredentialRegistry ==="
CR=$(deploy "$WASM/credential_registry.wasm" --admin "$ADMIN" --issuer_registry "$IR")
echo "CredentialRegistry: $CR"

echo "=== Deploy PolicyVerifier ==="
PV=$(deploy "$WASM/policy_verifier.wasm" --admin "$ADMIN")
echo "PolicyVerifier: $PV"

echo "=== Register policy ==="
stellar contract invoke --id "$PV" --source-account admin --network testnet --send yes -- \
  register_policy --admin "$ADMIN" --policy_id "$POLICY_ID" --vk-file-path "$VK"

echo "=== Deploy RwaToken ==="
RWA=$(deploy "$WASM/rwa_token.wasm" --admin "$ADMIN" --verifier "$PV" --policy_id "$POLICY_ID")
echo "RwaToken: $RWA"

echo "=== Seed issuers ==="
PUBKEY1=$(printf '%064d' 1)
stellar contract invoke --id "$IR" --source-account admin --network testnet --send yes -- \
  add_issuer --admin "$ADMIN" --issuer_id 1 --pubkey "$PUBKEY1"
stellar contract invoke --id "$IR" --source-account admin --network testnet --send yes -- \
  add_issuer --admin "$ADMIN" --issuer_id 2 --pubkey "$ETH_PUB"

echo "=== Set roots ==="
ROOT_HEX=$(node -e "const c=require('$ROOT/issuer-service/data/credential.json'); console.log(BigInt(c.root).toString(16).padStart(64,'0'))")
REV_HEX=$(node -e "const c=require('$ROOT/issuer-service/data/credential.json'); console.log(BigInt(c.revocationRoot).toString(16).padStart(64,'0'))")
stellar contract invoke --id "$CR" --source-account admin --network testnet --send yes -- \
  set_root --issuer "$ADMIN" --root "0x$ROOT_HEX"
stellar contract invoke --id "$CR" --source-account admin --network testnet --send yes -- \
  set_revocation_root --issuer "$ADMIN" --revocation_root "0x$REV_HEX"

echo "=== Verify proof on-chain (BN254) ==="
stellar contract invoke --id "$PV" --source-account deployer --network testnet --send yes -- \
  verify --policy_id "$POLICY_ID" --proof-file-path "$PROOF" --public_inputs-file-path "$PI" 2>&1 | tee /tmp/verify_tx.log

echo "=== Freeze sanctioned holder ==="
stellar contract invoke --id "$RWA" --source-account admin --network testnet --send yes -- \
  freeze --admin "$ADMIN" --holder "$SANCTIONED" 2>&1 | tee /tmp/freeze_tx.log

VERIFY_TX=$(grep -oE '[a-f0-9]{64}' /tmp/verify_tx.log | head -1 || true)
FREEZE_TX=$(grep -oE '[a-f0-9]{64}' /tmp/freeze_tx.log | head -1 || true)

node -e "
const fs=require('fs');
const d={
  network:'testnet',
  issuer_registry:'$IR',
  credential_registry:'$CR',
  policy_verifier:'$PV',
  rwa_token:'$RWA',
  policy_id:Number('$POLICY_ID'),
  verify_tx:'$VERIFY_TX',
  freeze_tx:'$FREEZE_TX',
  explorer:'https://stellar.expert/explorer/testnet'
};
fs.writeFileSync('$ROOT/deployments.json', JSON.stringify(d,null,2));
console.log(JSON.stringify(d,null,2));
"

# Append contract IDs to .env
for var in ISSUER_REGISTRY_ID CREDENTIAL_REGISTRY_ID POLICY_VERIFIER_ID RWA_TOKEN_ID; do
  sed -i "/^${var}=/d" "$ROOT/.env"
done
cat >> "$ROOT/.env" <<EOF
ISSUER_REGISTRY_ID=$IR
CREDENTIAL_REGISTRY_ID=$CR
POLICY_VERIFIER_ID=$PV
RWA_TOKEN_ID=$RWA
VITE_ISSUER_REGISTRY_ID=$IR
VITE_CREDENTIAL_REGISTRY_ID=$CR
VITE_POLICY_VERIFIER_ID=$PV
VITE_RWA_TOKEN_ID=$RWA
EOF

echo "DONE"
