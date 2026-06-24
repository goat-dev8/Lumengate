#!/usr/bin/env bash
# Deploy WebAuthn verifier, SessionKeyPolicy, Governance Timelock; redeploy CredentialRegistry with note_root.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r'; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
IR=$(node -e "console.log(require('$ROOT/deployments.json').issuer_registry)")
MIN_DELAY="${TIMELOCK_MIN_DELAY:-17280}"

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

bash "$ROOT/scripts/build_contracts.sh" >/dev/null
WASM="$ROOT/target/wasm32v1-none/release"

deploy() {
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/deploy_passkey_last.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_passkey_last.log | tail -1
}

echo "=== Redeploy CredentialRegistry (note_root) ==="
CR=$(deploy "$WASM/credential_registry.wasm" --admin "$ADMIN" --issuer_registry "$IR")
echo "CredentialRegistry: $CR"

echo "=== Deploy WebAuthn verifier ==="
WEBAUTHN=$(deploy "$WASM/webauthn_verifier.wasm")
echo "WebAuthnVerifier: $WEBAUTHN"

echo "=== Deploy SessionKeyPolicy ==="
SESSION=$(deploy "$WASM/session_key_policy.wasm")
echo "SessionKeyPolicy: $SESSION"

echo "=== Deploy Governance Timelock ==="
TIMELOCK=$(deploy "$WASM/governance_timelock.wasm" --min_delay "$MIN_DELAY" --proposers "[\"$ADMIN\"]" --executors "[\"$ADMIN\"]" --admin "$ADMIN")
echo "GovernanceTimelock: $TIMELOCK"

node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('$ROOT/deployments.json','utf8'));
d.credential_registry='$CR';
d.webauthn_verifier='$WEBAUTHN';
d.session_key_policy='$SESSION';
d.governance_timelock='$TIMELOCK';
d.transactions=d.transactions||{};
d.transactions.note_root_cr='$CR';
d.transactions.webauthn_verifier='$WEBAUTHN';
fs.writeFileSync('$ROOT/deployments.json', JSON.stringify(d,null,2));
"

for kv in \
  "CREDENTIAL_REGISTRY_ID=$CR" \
  "VITE_CREDENTIAL_REGISTRY_ID=$CR" \
  "WEBAUTHN_VERIFIER_ID=$WEBAUTHN" \
  "VITE_WEBAUTHN_VERIFIER_ID=$WEBAUTHN" \
  "SESSION_KEY_POLICY_ID=$SESSION" \
  "VITE_SESSION_KEY_POLICY_ID=$SESSION" \
  "TIMELOCK_CONTRACT_ID=$TIMELOCK" \
  "VITE_TIMELOCK_CONTRACT_ID=$TIMELOCK"; do
  key="${kv%%=*}"
  sed -i "/^${key}=/d" "$ROOT/.env"
  echo "$kv" >> "$ROOT/.env"
done

echo "DONE CR=$CR WEBAUTHN=$WEBAUTHN SESSION=$SESSION TIMELOCK=$TIMELOCK"
