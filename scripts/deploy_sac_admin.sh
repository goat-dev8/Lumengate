#!/usr/bin/env bash
# Deploy ComplianceSacAdmin for proof-gated USDC SAC transfers.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r'; }

ADMIN=$(get_env CONTRACT_ADMIN_PUBLIC_KEY)
ADAPTER=$(node -e "console.log(require('$ROOT/deployments.json').rwa_adapter)")
USDC_SAC=$(get_env VITE_USDC_SAC_ID)
POLICY_ID=$(get_env POLICY_ID)

printf '%s' "$(get_env DEPLOYER_SECRET_KEY)" | stellar keys add deployer --secret-key --overwrite 2>/dev/null || true
stellar network use testnet

echo "=== Build compliance_sac_admin ==="
(cd "$ROOT/contracts/compliance_sac_admin" && stellar contract build --optimize >/dev/null)

WASM="$ROOT/target/wasm32v1-none/release/compliance_sac_admin.wasm"
if [[ ! -f "$WASM" ]]; then
  echo "WASM missing at $WASM" >&2
  exit 1
fi

EURC_SAC="${VITE_EURC_SAC_ID:-$(grep '^VITE_EURC_SAC_ID=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)}"
if [[ -z "$EURC_SAC" ]]; then
  EURC_SAC=$(stellar contract id asset --asset "EURC:GA5NJ3H2BQG2Y7SGCHLMSQS3VFDJ236NRUTVF3HQDPKCQED6IN7GYLZK" --network testnet 2>/dev/null | tail -1)
fi

echo "=== Deploy ComplianceSacAdmin (adapter=$ADAPTER usdc=$USDC_SAC eurc=$EURC_SAC policy=$POLICY_ID) ==="
stellar contract deploy --wasm "$WASM" --source-account deployer --network testnet -- \
  --admin "$ADMIN" --adapter "$ADAPTER" --usdc_sac "$USDC_SAC" --eurc_sac "$EURC_SAC" --policy_id "$POLICY_ID" \
  2>&1 | tee /tmp/deploy_sac_admin.log

SAC_ADMIN=$(grep -oE 'C[A-Z0-9]{55}' /tmp/deploy_sac_admin.log | tail -1)
if [[ -z "$SAC_ADMIN" ]]; then
  echo "Deploy failed — no contract ID in log" >&2
  exit 1
fi
echo "ComplianceSacAdmin: $SAC_ADMIN"

echo "=== Verify sac_address read ==="
stellar contract invoke --id "$SAC_ADMIN" --source-account deployer --network testnet -- \
  sac_address 2>&1 | tee /tmp/sac_admin_read.log

node -e "
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('$ROOT/deployments.json','utf8'));
d.compliance_sac_admin='$SAC_ADMIN';
fs.writeFileSync('$ROOT/deployments.json', JSON.stringify(d,null,2));
"

for var in COMPLIANCE_SAC_ADMIN_ID VITE_COMPLIANCE_SAC_ADMIN_ID; do
  sed -i "/^${var}=/d" "$ROOT/.env"
done
cat >> "$ROOT/.env" <<EOF
COMPLIANCE_SAC_ADMIN_ID=$SAC_ADMIN
VITE_COMPLIANCE_SAC_ADMIN_ID=$SAC_ADMIN
VITE_EURC_SAC_ID=$EURC_SAC
VITE_EURC_ISSUER=GA5NJ3H2BQG2Y7SGCHLMSQS3VFDJ236NRUTVF3HQDPKCQED6IN7GYLZK
EOF

for f in development production local; do
  ENV_FILE="$ROOT/app/.env.$f"
  [[ -f "$ENV_FILE" ]] || continue
  sed -i "/^VITE_COMPLIANCE_SAC_ADMIN_ID=/d" "$ENV_FILE"
  echo "VITE_COMPLIANCE_SAC_ADMIN_ID=$SAC_ADMIN" >> "$ENV_FILE"
done

[[ -f "$ROOT/app/.env.local" ]] && {
  sed -i "/^VITE_COMPLIANCE_SAC_ADMIN_ID=/d" "$ROOT/app/.env.local"
  echo "VITE_COMPLIANCE_SAC_ADMIN_ID=$SAC_ADMIN" >> "$ROOT/app/.env.local"
}

echo "DONE — ComplianceSacAdmin=$SAC_ADMIN"

# Settlement recipient must hold USDC trustline for SAC transfers.
SETTLE=$(get_env VITE_MARKETPLACE_SETTLEMENT_ADDRESS | tr -d '\r')
if [[ -n "$SETTLE" ]]; then
  ADMIN_SEC=$(get_env CONTRACT_ADMIN_SECRET_KEY)
  if [[ "$SETTLE" == "$(get_env CONTRACT_ADMIN_PUBLIC_KEY | tr -d '\r')" ]]; then
    printf '%s' "$ADMIN_SEC" | stellar keys add admin --secret-key --overwrite 2>/dev/null || true
    curl -sf "$(get_env FRIENDBOT_URL)?addr=$SETTLE" >/dev/null || true
    stellar tx new change-trust --source-account admin --network testnet \
      --line "USDC:$(get_env VITE_USDC_ISSUER | tr -d '\r')" --limit 100000000 --auto-sign 2>/dev/null || true
  fi
fi
