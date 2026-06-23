#!/usr/bin/env bash
# Extend Soroban contract instance TTL before demo / judging.
# Run ~24h before a live demo to avoid archival failures on get_roots / transfer.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

LEDGERS="${LEDGERS_TO_EXTEND:-535680}"
NETWORK="${STELLAR_NETWORK:-testnet}"
SOURCE="${TTL_EXTEND_SOURCE:-deployer}"

read_env() {
  local key="$1"
  local val
  val="$(grep -E "^${key}=" "$ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  if [[ -z "$val" && -f "$ROOT/app/.env.development" ]]; then
    val="$(grep -E "^VITE_${key}=" "$ROOT/app/.env.development" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
    val="${val#VITE_}"
  fi
  echo "$val"
}

PV="$(read_env POLICY_VERIFIER_ID)"
CR="$(read_env CREDENTIAL_REGISTRY_ID)"
RWA="$(read_env RWA_TOKEN_ID)"
IR="$(read_env ISSUER_REGISTRY_ID)"

if [[ -z "$PV" || -z "$CR" || -z "$RWA" ]]; then
  echo "Missing contract IDs. Set POLICY_VERIFIER_ID, CREDENTIAL_REGISTRY_ID, RWA_TOKEN_ID in .env" >&2
  exit 1
fi

stellar network use "$NETWORK" 2>/dev/null || true

extend_instance() {
  local id="$1"
  local label="$2"
  echo "=== Extend instance TTL: $label ($id) by $LEDGERS ledgers ==="
  stellar contract extend \
    --id "$id" \
    --ledgers-to-extend "$LEDGERS" \
    --source-account "$SOURCE" \
    --network "$NETWORK"
}

echo "Lumengate demo TTL extend — network=$NETWORK ledgers=$LEDGERS source=$SOURCE"
echo ""

extend_instance "$PV" "PolicyVerifier"
extend_instance "$CR" "CredentialRegistry"
extend_instance "$RWA" "RwaToken"

if [[ -n "$IR" ]]; then
  extend_instance "$IR" "IssuerRegistry"
fi

echo ""
echo "Done. Instance TTL extended for demo contracts."
echo "If simulation still fails with StorageEntryNotFound, restore archived entries:"
echo "  stellar contract restore --id <CONTRACT_ID> --key <KEY> --source-account $SOURCE --network $NETWORK"
echo "See DEMO_RUNBOOK.md for full pre-demo checklist."
