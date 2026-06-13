#!/usr/bin/env bash
# Migrate IssuerRegistry issuer #2 from secp256k1 to Stellar Ed25519 pubkey.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2-; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
ISSUER_ID=$(get_env ISSUER_ID)
ISSUER_ID=${ISSUER_ID:-2}
PUBKEY=$(get_env ISSUER_ED25519_PUBKEY_BYTES64)
IR=$(node -e "console.log(require('$ROOT/deployments.json').issuer_registry)")

if [[ -z "$PUBKEY" ]]; then
  echo "ISSUER_ED25519_PUBKEY_BYTES64 missing in .env" >&2
  exit 1
fi

printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Revoke legacy issuer $ISSUER_ID on $IR ==="
stellar contract invoke --id "$IR" --source-account admin --network testnet --send yes -- \
  revoke_issuer --admin "$ADMIN" --issuer_id "$ISSUER_ID" || true

echo "=== Register Ed25519 issuer $ISSUER_ID ==="
stellar contract invoke --id "$IR" --source-account admin --network testnet --send yes -- \
  add_issuer --admin "$ADMIN" --issuer_id "$ISSUER_ID" --pubkey "$PUBKEY"

echo "=== Verify on-chain pubkey ==="
stellar contract invoke --id "$IR" --source-account admin --network testnet -- \
  get_pubkey --issuer_id "$ISSUER_ID"

echo "Ed25519 issuer registration complete."
