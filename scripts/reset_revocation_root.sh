#!/usr/bin/env bash
# Reset CredentialRegistry revocation root to circuit empty-path value.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'; }

CR=$(node -e "console.log(require('$ROOT/deployments.json').credential_registry)")
ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
REV_HEX="151e1f66eeb82f00af0d965d38a95b30cdc1ccf819d4f75c885b69a6879e0b76"

printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

stellar contract invoke --id "$CR" --source-account admin --network testnet --send yes -- \
  set_revocation_root --caller "$ADMIN" --revocation_root "$REV_HEX"

REV_FILE="$ROOT/issuer-service/data/revoked_commitments.json"
mkdir -p "$(dirname "$REV_FILE")"
echo '[]' > "$REV_FILE"

echo "Reset revocation root on $CR to empty-path value 0x$REV_HEX"
echo "Cleared local revoked commitment store: $REV_FILE"
