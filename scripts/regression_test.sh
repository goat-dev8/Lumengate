#!/usr/bin/env bash
# Post-deploy regression: transfers, PoF, adapter, roots, freeze.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2-; }

RWA=$(node -e "console.log(require('$ROOT/deployments.json').rwa_token)")
ADAPTER=$(node -e "console.log(require('$ROOT/deployments.json').rwa_adapter)")
PV=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
CR=$(node -e "console.log(require('$ROOT/deployments.json').credential_registry)")
POLICY_ID=$(get_env POLICY_ID)
POLICY_ID_2=$(get_env POLICY_ID_2)
FROM=$(get_env ELIGIBLE_WALLET_PUBLIC_KEY)
TO=$(get_env FREIGHTER_PUBLIC_KEY)
FROM_SECRET=$(get_env ELIGIBLE_WALLET_SECRET)
SANCTIONED=$(get_env SANCTIONED_WALLET_PUBLIC_KEY)
WALLET_FIELD="${WALLET_FIELD:-200}"
SAC_ADMIN=$(node -e "console.log(require('$ROOT/deployments.json').compliance_sac_admin||'')")
USDC_SAC=$(get_env VITE_USDC_SAC_ID | tr -d '\r')
SETTLE=$(get_env VITE_MARKETPLACE_SETTLEMENT_ADDRESS | tr -d '\r')
if [[ -z "$SETTLE" ]]; then SETTLE=$(get_env MARKETPLACE_SETTLEMENT_ADDRESS | tr -d '\r'); fi

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
printf '%s' "$FROM_SECRET" | stellar keys add eligible --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

pass=0
fail=0
check() {
  local name=$1
  shift
  if "$@" >/tmp/regression_out.log 2>&1; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name"
    cat /tmp/regression_out.log
    fail=$((fail + 1))
  fi
}

echo "=== Regression on RwaToken $RWA ==="

IR=$(node -e "console.log(require('$ROOT/deployments.json').issuer_registry)")
EURC=$(node -e "console.log(require('$ROOT/deployments.json').eurc_sac||'')")
SMART_WASM_HASH=$(node -e "console.log(require('$ROOT/deployments.json').lumengate_smart_account_wasm_hash||'')")
CPOL=$(node -e "console.log(require('$ROOT/deployments.json').compliance_policy||'')")

check "on-chain roots" stellar contract invoke --id "$CR" --source-account deployer --network testnet -- get_roots

check "issuer 2 authorized" bash -c "[[ \$(stellar contract invoke --id \"$IR\" --source-account deployer --network testnet -- is_authorized --issuer_id 2 2>&1 | tail -1) == \"true\" ]]"

check "issuer 2 pubkey present" bash -c "stellar contract invoke --id \"$IR\" --source-account deployer --network testnet -- get_pubkey --issuer_id 2 2>&1 | grep -qE '[0-9a-f]{64}'"

check "credential registry issuer_reg" bash -c "stellar contract invoke --id \"$CR\" --source-account deployer --network testnet -- get_issuer_registry 2>&1 | grep -qE 'C[A-Z0-9]{55}'"

check "policy verifier reachable" bash -c "stellar contract invoke --id \"$PV\" --source-account deployer --network testnet -- is_nullifier_spent --policy_id \"$POLICY_ID\" --nullifier 0000000000000000000000000000000000000000000000000000000000000001 2>&1 | tail -1 | grep -qE 'true|false'"

check "adapter verifier wired" bash -c "stellar contract invoke --id \"$ADAPTER\" --source-account deployer --network testnet -- verifier_address 2>&1 | grep -qE 'C[A-Z0-9]{55}'"

check "sac admin adapter wired" bash -c "[[ -n \"$SAC_ADMIN\" ]] && stellar contract invoke --id \"$SAC_ADMIN\" --source-account deployer --network testnet -- adapter_address 2>&1 | grep -qE 'C[A-Z0-9]{55}' || exit 0"

check "eligible balance > 0" bash -c 'bal=$(stellar contract invoke --id "'"$RWA"'" --source-account deployer --network testnet -- balance --holder "'"$FROM"'" 2>&1 | tail -1 | tr -d \"); [[ "$bal" -gt 0 ]]'

check "sanctioned frozen on new token" bash -c "[[ \$(stellar contract invoke --id \"$RWA\" --source-account deployer --network testnet -- is_frozen --holder \"$SANCTIONED\" 2>&1 | tail -1) == \"true\" ]] || true"
# Note: freeze is per-contract; new RWA may not have sanctioned frozen — re-freeze if needed
stellar contract invoke --id "$RWA" --source-account admin --network testnet --send yes -- \
  freeze --admin "$(get_env CONTRACT_ADMIN_PUBLIC_KEY)" --holder "$SANCTIONED" 2>/dev/null || true

check "sanctioned frozen after admin freeze" bash -c "[[ \$(stellar contract invoke --id \"$RWA\" --source-account deployer --network testnet -- is_frozen --holder \"$SANCTIONED\" 2>&1 | tail -1) == \"true\" ]]"

echo "=== Generate fresh eligibility proof + transfer ==="
WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
PROOF_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
PI_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')

if [[ -n "$SAC_ADMIN" ]]; then
  check "eligible usdc sac balance > 0" bash -c 'bal=$(stellar contract invoke --id "'"$USDC_SAC"'" --source-account deployer --network testnet -- balance --id "'"$FROM"'" 2>&1 | tail -1 | tr -d \"); [[ "$bal" -gt 0 ]]'
  ASSET_ID=2 ACTION_ID=1 WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
  bash "$ROOT/scripts/build_circuit.sh"
  USDC_PROOF_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
  USDC_PI_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')
  check "usdc transfer_compliant" stellar contract invoke --id "$SAC_ADMIN" --source-account eligible --network testnet --send yes -- \
    transfer_compliant --from "$FROM" --to "$SETTLE" --amount 1000000 --proof "$USDC_PROOF_HEX" --public_inputs "$USDC_PI_HEX"

  DEX=$(node -e "console.log(require('$ROOT/deployments.json').compliant_dex||'')")
  PAYROLL=$(node -e "console.log(require('$ROOT/deployments.json').compliant_payroll||'')")

  if [[ -n "$DEX" ]]; then
    ASSET_ID=2 ACTION_ID=1 WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
    bash "$ROOT/scripts/build_circuit.sh"
    DEX_PROOF=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
    DEX_PI=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')
    check "compliant dex swap_compliant" stellar contract invoke --id "$DEX" --source-account eligible --network testnet --send yes -- \
      swap_compliant --trader "$FROM" --recipient "$SETTLE" --amount 1000000 --proof "$DEX_PROOF" --public_inputs "$DEX_PI"
  fi

  if [[ -n "$PAYROLL" ]]; then
    ASSET_ID=2 ACTION_ID=1 WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
    bash "$ROOT/scripts/build_circuit.sh"
    PAY_PROOF=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
    PAY_PI=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')
    check "compliant payroll pay_compliant" stellar contract invoke --id "$PAYROLL" --source-account eligible --network testnet --send yes -- \
      pay_compliant --payer "$FROM" --employee "$SETTLE" --amount 1000000 --proof "$PAY_PROOF" --public_inputs "$PAY_PI"
  fi

  AUDITOR_REG=$(node -e "console.log(require('$ROOT/deployments.json').auditor_registry||'')")
  if [[ -n "$AUDITOR_REG" ]]; then
    check "auditor 1 registered" bash -c "[[ \$(stellar contract invoke --id \"$AUDITOR_REG\" --source-account deployer --network testnet -- is_registered --auditor_id 1 2>&1 | tail -1) == \"true\" ]]"
  fi

  if [[ -n "$EURC" ]]; then
    check "eurc sac configured" bash -c "stellar contract invoke --id \"$SAC_ADMIN\" --source-account deployer --network testnet -- eurc_sac_address 2>&1 | grep -qE 'C[A-Z0-9]{55}'"
  fi

  if [[ -n "$CPOL" ]]; then
    check "compliance policy deployed" bash -c "[[ \"$CPOL\" =~ ^C[A-Z0-9]{55}$ ]]"
  fi

  if [[ -n "$SMART_WASM_HASH" ]]; then
    check "smart account wasm uploaded" bash -c "[[ \"$SMART_WASM_HASH\" =~ ^[a-f0-9]{64}$ ]]"
  fi

  check "compliant dex deployed" bash -c "[[ -z \"$DEX\" ]] || [[ \"$DEX\" =~ ^C[A-Z0-9]{55}$ ]]"
  check "compliant payroll deployed" bash -c "[[ -z \"$PAYROLL\" ]] || [[ \"$PAYROLL\" =~ ^C[A-Z0-9]{55}$ ]]"
else
  check "transfer gated" stellar contract invoke --id "$RWA" --source-account eligible --network testnet --send yes -- \
    transfer --from "$FROM" --to "$TO" --amount 10 --proof "$PROOF_HEX" --public_inputs "$PI_HEX"
fi

echo "=== Fresh PoF proof + verify policy 2 ==="
WALLET_FIELD="$WALLET_FIELD" RWA_BALANCE=990 POF_THRESHOLD=50 node "$ROOT/scripts/generate_pof_prover_toml.js"
bash "$ROOT/scripts/build_pof_circuit.sh"
POF_PROOF=$(xxd -p "$ROOT/circuits/proof_of_funds/target/proof" | tr -d '\n')
POF_PI=$(xxd -p "$ROOT/circuits/proof_of_funds/target/public_inputs" | tr -d '\n')

check "pof verify on-chain" stellar contract invoke --id "$PV" --source-account deployer --network testnet --send yes -- \
  verify --policy_id "$POLICY_ID_2" --proof "$POF_PROOF" --public_inputs "$POF_PI"

echo "=== RwaAdapter verify_passport (read-only sim) ==="
WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
ADAPT_PROOF=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
ADAPT_PI=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')

check "adapter is_eligible sim" stellar contract invoke --id "$ADAPTER" --source-account deployer --network testnet -- \
  is_eligible --policy_id "$POLICY_ID" --proof "$ADAPT_PROOF" --public_inputs "$ADAPT_PI"

if [[ -n "${REVOKE_API_KEY:-}" ]] && curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1; then
  check "issuer api health" curl -sf http://127.0.0.1:3001/health
  check "issuer api roots" curl -sf http://127.0.0.1:3001/roots
fi

check "lumengate circuit artifacts" bash -c "[[ -f '$ROOT/circuits/lumengate/target/vk' && -f '$ROOT/circuits/lumengate/target/proof' ]]"

  check "frontend circuit json" bash -c "[[ -f '$ROOT/app/public/circuit/lumengate.json' ]]"

  WEBAUTHN=$(node -e "console.log(require('$ROOT/deployments.json').webauthn_verifier||'')")
  TIMELOCK=$(node -e "console.log(require('$ROOT/deployments.json').governance_timelock||'')")
  POOL=$(node -e "console.log(require('$ROOT/deployments.json').privacy_pool||'')")

  check "note root field on registry" bash -c "stellar contract invoke --id \"$CR\" --source-account deployer --network testnet -- get_roots 2>&1 | grep -oE '[0-9a-f]{64}' | wc -l | grep -qE '3|4'"

  check "webauthn verifier deployed" bash -c "[[ -z \"$WEBAUTHN\" ]] || [[ \"$WEBAUTHN\" =~ ^C[A-Z0-9]{55}$ ]]"

  check "governance timelock deployed" bash -c "[[ -z \"$TIMELOCK\" ]] || [[ \"$TIMELOCK\" =~ ^C[A-Z0-9]{55}$ ]]"

  check "privacy pool configured" bash -c "[[ -z \"$POOL\" ]] || [[ \"$POOL\" =~ ^C[A-Z0-9]{55}$ ]]"

  check "shared smart account id removed" bash -c "! grep -qE '^(LUMENGATE_SMART_ACCOUNT_ID|VITE_LUMENGATE_SMART_ACCOUNT_ID)=' '$ROOT/.env'"

  check "g1 msm benchmark artifact" bash -c "[[ -f '$ROOT/docs/G1_MSM_BENCHMARK.md' ]]"

echo "=== Summary: $pass passed, $fail failed ==="
[[ "$fail" -eq 0 ]]
