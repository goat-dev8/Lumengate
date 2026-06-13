#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r'; }
FREIGHTER=$(get_env FREIGHTER_PUBLIC_KEY)
TREASURY=$(get_env VITE_MARKETPLACE_SETTLEMENT_ADDRESS)
ELIG=$(get_env ELIGIBLE_WALLET_PUBLIC_KEY)
SAC=$(get_env VITE_USDC_SAC_ID)
RWA=$(get_env VITE_RWA_TOKEN_ID)
ISSUER=$(get_env VITE_USDC_ISSUER)

classic() {
  local g=$1
  curl -sf "https://horizon-testnet.stellar.org/accounts/$g" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  u=[b for b in d['balances'] if b.get('asset_code')=='USDC']
  print(u[0]['balance'] if u else 'NO_TRUSTLINE')
except Exception as e:
  print('ERROR', e)
"
}

sac() {
  stellar contract invoke --id "$SAC" --source-account deployer --network testnet -- balance --id "$1" 2>&1 | tail -1 | tr -d '"'
}

rwa() {
  stellar contract invoke --id "$RWA" --source-account deployer --network testnet -- balance --holder "$1" 2>&1 | tail -1 | tr -d '"'
}

echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "FREIGHTER $FREIGHTER"
echo "  classic_usdc: $(classic "$FREIGHTER")"
echo "  sac_stroops: $(sac "$FREIGHTER")"
echo "  rwa_units: $(rwa "$FREIGHTER")"
echo "TREASURY $TREASURY"
echo "  classic_usdc: $(classic "$TREASURY")"
echo "  sac_stroops: $(sac "$TREASURY")"
echo "ELIGIBLE $ELIG"
echo "  classic_usdc: $(classic "$ELIG")"
echo "  sac_stroops: $(sac "$ELIG")"
echo "  rwa_units: $(rwa "$ELIG")"
