#!/usr/bin/env bash
# Deploy V3 contracts: AuditorRegistry, CompliantDEX, CompliantPayroll, CompliancePolicy, LumengateSmartAccount.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r'; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
ADAPTER=$(node -e "console.log(require('$ROOT/deployments.json').rwa_adapter)")
USDC_SAC=$(get_env VITE_USDC_SAC_ID)
EURC_SAC="${VITE_EURC_SAC_ID:-$(grep '^VITE_EURC_SAC_ID=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)}"
POLICY_ID=$(get_env POLICY_ID)

if [[ -z "$EURC_SAC" ]]; then
  EURC_SAC=$(stellar contract id asset --asset "EURC:GA5NJ3H2BQG2Y7SGCHLMSQS3VFDJ236NRUTVF3HQDPKCQED6IN7GYLZK" --network testnet 2>/dev/null | tail -1)
fi

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
printf '%s' "$(get_env CONTRACT_ADMIN_SECRET_KEY)" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Build V3 contracts ==="
bash "$ROOT/scripts/build_contracts.sh" >/dev/null

WASM="$ROOT/target/wasm32v1-none/release"

deploy() {
  local wasm=$1
  shift
  stellar contract deploy --wasm "$wasm" --source-account deployer --network testnet -- "$@" 2>&1 | tee /tmp/deploy_v3_last.log >/dev/null
  grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_v3_last.log | tail -1
}

echo "=== Deploy AuditorRegistry ==="
AUDITOR=$(deploy "$WASM/auditor_registry.wasm" --admin "$ADMIN")
echo "AuditorRegistry: $AUDITOR"

echo "=== Deploy CompliantDEX ==="
DEX=$(deploy "$WASM/compliant_dex.wasm" --admin "$ADMIN" --adapter "$ADAPTER" --sac "$USDC_SAC" --policy_id "$POLICY_ID")
echo "CompliantDex: $DEX"

echo "=== Deploy CompliantPayroll ==="
PAYROLL=$(deploy "$WASM/compliant_payroll.wasm" --admin "$ADMIN" --adapter "$ADAPTER" --sac "$USDC_SAC" --policy_id "$POLICY_ID")
echo "CompliantPayroll: $PAYROLL"

echo "=== Deploy CompliancePolicy ==="
COMPLIANCE_POLICY=$(deploy "$WASM/compliance_policy.wasm")
echo "CompliancePolicy: $COMPLIANCE_POLICY"

echo "=== Deploy LumengateSmartAccount ==="
SMART=$(deploy "$WASM/lumengate_smart_account.wasm" --admin "$ADMIN" --compliance_policy "$COMPLIANCE_POLICY" --adapter "$ADAPTER" --policy_id "$POLICY_ID")
echo "LumengateSmartAccount: $SMART"

echo "=== Register auditor (viewing key hash from env) ==="
VIEWING_KEY="${AUDITOR_VIEWING_KEY:-lumengate-auditor-testnet-key}"
VIEWING_HASH=$(node -e "const c=require('crypto'); console.log(c.createHash('sha256').update(process.argv[1]).digest('hex'))" "$VIEWING_KEY")
stellar contract invoke --id "$AUDITOR" --source-account admin --network testnet --send yes -- \
  register_auditor --caller "$ADMIN" --auditor_id 1 --viewing_key_hash "$VIEWING_HASH" --label "Testnet auditor" \
  2>&1 | tee /tmp/register_auditor.log || true

node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('$ROOT/deployments.json','utf8'));
d.auditor_registry='$AUDITOR';
d.compliant_dex='$DEX';
d.compliant_payroll='$PAYROLL';
d.compliance_policy='$COMPLIANCE_POLICY';
d.lumengate_smart_account='$SMART';
d.eurc_sac='$EURC_SAC';
d.transactions=d.transactions||{};
d.transactions.v3_auditor_deploy='$(grep -oE '[a-f0-9]{64}' /tmp/register_auditor.log | head -1 || echo '')';
fs.writeFileSync('$ROOT/deployments.json', JSON.stringify(d,null,2));
"

for kv in \
  "AUDITOR_REGISTRY_ID=$AUDITOR" \
  "COMPLIANT_DEX_ID=$DEX" \
  "COMPLIANT_PAYROLL_ID=$PAYROLL" \
  "COMPLIANCE_POLICY_ID=$COMPLIANCE_POLICY" \
  "LUMENGATE_SMART_ACCOUNT_ID=$SMART" \
  "VITE_EURC_SAC_ID=$EURC_SAC" \
  "VITE_EURC_ISSUER=GA5NJ3H2BQG2Y7SGCHLMSQS3VFDJ236NRUTVF3HQDPKCQED6IN7GYLZK" \
  "VITE_AUDITOR_REGISTRY_ID=$AUDITOR" \
  "VITE_COMPLIANT_DEX_ID=$DEX" \
  "VITE_COMPLIANT_PAYROLL_ID=$PAYROLL" \
  "VITE_COMPLIANCE_POLICY_ID=$COMPLIANCE_POLICY" \
  "VITE_LUMENGATE_SMART_ACCOUNT_ID=$SMART"; do
  key="${kv%%=*}"
  sed -i "/^${key}=/d" "$ROOT/.env"
  echo "$kv" >> "$ROOT/.env"
done

for f in development production local; do
  ENV_FILE="$ROOT/app/.env.$f"
  [[ -f "$ENV_FILE" ]] || continue
  for key in VITE_EURC_SAC_ID VITE_EURC_ISSUER VITE_AUDITOR_REGISTRY_ID VITE_COMPLIANT_DEX_ID VITE_COMPLIANT_PAYROLL_ID VITE_COMPLIANCE_POLICY_ID VITE_LUMENGATE_SMART_ACCOUNT_ID; do
    sed -i "/^${key}=/d" "$ENV_FILE"
  done
  cat >> "$ENV_FILE" <<EOF
VITE_EURC_SAC_ID=$EURC_SAC
VITE_EURC_ISSUER=GA5NJ3H2BQG2Y7SGCHLMSQS3VFDJ236NRUTVF3HQDPKCQED6IN7GYLZK
VITE_AUDITOR_REGISTRY_ID=$AUDITOR
VITE_COMPLIANT_DEX_ID=$DEX
VITE_COMPLIANT_PAYROLL_ID=$PAYROLL
VITE_COMPLIANCE_POLICY_ID=$COMPLIANCE_POLICY
VITE_LUMENGATE_SMART_ACCOUNT_ID=$SMART
EOF
done

echo "DONE — Auditor=$AUDITOR DEX=$DEX Payroll=$PAYROLL Policy=$COMPLIANCE_POLICY SmartAccount=$SMART EURC_SAC=$EURC_SAC"
