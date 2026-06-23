#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.nargo/bin:$HOME/.bb/bin:$PATH"
cd "$ROOT/circuits/proof_of_funds"

WALLET_FIELD="${WALLET_FIELD:-200}"
RWA_BALANCE="${RWA_BALANCE:-100}"
POF_THRESHOLD="${POF_THRESHOLD:-50}"

WALLET_FIELD="$WALLET_FIELD" RWA_BALANCE="$RWA_BALANCE" POF_THRESHOLD="$POF_THRESHOLD" \
  node "$ROOT/scripts/generate_pof_prover_toml.js"

nargo compile
nargo execute

JSON="target/proof_of_funds.json"
GZ="target/proof_of_funds.gz"

bb prove \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --bytecode_path "$JSON" \
  --witness_path "$GZ" \
  --output_path target \
  --output_format bytes_and_fields

bb write_vk \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --bytecode_path "$JSON" \
  --output_path target \
  --output_format bytes_and_fields

if [[ -d target/vk && -f target/vk/vk ]]; then
  mv target/vk/vk target/vk.tmp
  rmdir target/vk
  mv target/vk.tmp target/vk
fi

mkdir -p "$ROOT/app/public/circuit"
cp "$JSON" "$ROOT/app/public/circuit/proof_of_funds.json"

echo "PoF circuit artifacts in $ROOT/circuits/proof_of_funds/target/"
