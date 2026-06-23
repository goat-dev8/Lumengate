#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.nargo/bin:$HOME/.bb/bin:$PATH"
cd "$ROOT/circuits/lumengate"

nargo compile
nargo execute

JSON="target/lumengate.json"
GZ="target/lumengate.gz"

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
cp "$JSON" "$ROOT/app/public/circuit/lumengate.json"

echo "Circuit artifacts in $ROOT/circuits/lumengate/target/"
echo "Copied browser circuit to $ROOT/app/public/circuit/lumengate.json"
