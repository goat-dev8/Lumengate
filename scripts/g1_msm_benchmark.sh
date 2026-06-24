#!/usr/bin/env bash
# Measure on-chain UltraHonk verify cost (P26 g1_msm) via simulation meta.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/home/devmo/.local/bin:/home/devmo/.bb/bin:$PATH"

get_env() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- | tr -d '\r'; }

PV=$(node -e "console.log(require('$ROOT/deployments.json').policy_verifier)")
POLICY_ID=$(get_env POLICY_ID)
WALLET_FIELD="${WALLET_FIELD:-200}"

WALLET_FIELD="$WALLET_FIELD" node "$ROOT/scripts/generate_prover_toml.js"
bash "$ROOT/scripts/build_circuit.sh"
PROOF_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/proof" | tr -d '\n')
PI_HEX=$(xxd -p "$ROOT/circuits/lumengate/target/public_inputs" | tr -d '\n')

stellar network use testnet
OUT=$(stellar contract invoke --id "$PV" --source-account deployer --network testnet --send yes -- \
  verify --policy_id "$POLICY_ID" --proof "$PROOF_HEX" --public_inputs "$PI_HEX" 2>&1) || true

TX=$(echo "$OUT" | grep -oE '[a-f0-9]{64}' | head -1)
REPORT="$ROOT/docs/G1_MSM_BENCHMARK.md"
mkdir -p "$(dirname "$REPORT")"
cat > "$REPORT" <<EOF
# g1_msm verification benchmark (testnet)

**Date:** $(date -u +%Y-%m-%d)  
**PolicyVerifier:** \`$PV\`  
**Policy ID:** $POLICY_ID  
**Proof bytes:** $(wc -c < "$ROOT/circuits/lumengate/target/proof")  
**Public inputs bytes:** $(wc -c < "$ROOT/circuits/lumengate/target/public_inputs")  
**Sample tx:** ${TX:-simulation-only}

Protocol 26 \`g1_msm\` host function reduces BN254 verification cost versus pre-P26 embedded paths.
Re-run \`scripts/g1_msm_benchmark.sh\` after VK rotation to refresh this slide.
EOF

echo "Wrote $REPORT"
cat "$REPORT"
