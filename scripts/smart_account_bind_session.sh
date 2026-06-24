#!/usr/bin/env bash
# Bind eligibility proof to CompliancePolicy via an explicit per-user Lumengate smart account.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r'; }

SMART="${SMART_ACCOUNT_ID:-${1:-}}"
CPOL=$(node -e "console.log(require('$ROOT/deployments.json').compliance_policy||'')")
WALLET_FIELD="${WALLET_FIELD:-200}"

[[ "$SMART" =~ ^C[A-Z0-9]{55}$ && -n "$CPOL" ]] || {
  echo "Set SMART_ACCOUNT_ID to the user's deployed smart account contract ID.";
  exit 1;
}

printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
PROOF_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
PI_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')

echo "=== bind_session_proof on $SMART ==="
stellar contract invoke --id "$SMART" --source-account admin --network testnet --send yes -- \
  bind_session_proof \
  --admin "$(get_env CONTRACT_ADMIN_PUBLIC_KEY)" \
  --compliance_policy "$CPOL" \
  --proof "$PROOF_HEX" \
  --public_inputs "$PI_HEX"

echo "PASS: session proof bound"
