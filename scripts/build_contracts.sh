#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"
cd "$ROOT"

for pkg in issuer-registry credential-registry policy-verifier rwa-token rwa-adapter compliance-sac-admin auditor-registry compliant-dex compliant-payroll session-store compliance-policy lumengate-smart-account webauthn-verifier session-key-policy governance-timelock; do
  echo "Building $pkg..."
  stellar contract build --package "$pkg" --optimize
done

echo "WASM artifacts in target/wasm32v1-none/release/"
