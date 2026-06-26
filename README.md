# Lumengate

Privacy-preserving compliance for Stellar. Prove eligibility with zero-knowledge proofs, verify on Soroban, and settle USDC/EURC without putting identity on-chain.

## What it does

- **Issuer service** — Stellar Ed25519-signed credentials, Merkle roots, revocation, auditor disclosures
- **Noir circuits** — Eligibility + proof-of-funds (UltraHonk; eligibility uses 6 public inputs: root, revocation root, policy, asset, action, nullifier)
- **Soroban contracts** — Policy verifier (external UltraHonk), credential registry, RWA adapter, SAC admin, compliant DEX/payroll, auditor registry, smart account scaffold
- **React app** — Wallet connect, credential request, in-browser proving, compliant transfers

**Network:** Stellar Soroban testnet only.

## Repository layout

| Path | Purpose |
|------|---------|
| `contracts/` | Soroban Rust contracts |
| `circuits/` | Noir eligibility + proof-of-funds |
| `issuer-service/` | Express issuer API (Render) |
| `app/` | Vite/React frontend (Vercel) |
| `scripts/` | Deploy, regression, circuit build |
| `vendor/rs-soroban-ultrahonk/` | External UltraHonk verifier (vendored) |
| `deployments.json` | Testnet contract IDs (public) |

## Quick start (local)

### Prerequisites

- Node.js 20+
- Rust + `stellar` CLI
- `nargo` + `bb` (Noir / Barretenberg)
- Playwright browser dependencies for e2e (`npx playwright install-deps chromium`, requires sudo on Linux)

### Backend

```bash
cp issuer-service/.env.example issuer-service/.env   # fill from your testnet keys
cd issuer-service && npm install && npm start
```

### Frontend

```bash
cp app/.env.example app/.env.local   # set VITE_* contract IDs + issuer URL
cd app && npm install && npm run dev
```

### Contracts & circuits

```bash
# Build contracts
for d in contracts/*/; do (cd "$d" && stellar contract build --optimize); done

# Build eligibility circuit + copy to app
node scripts/generate_prover_toml.js
bash scripts/build_circuit.sh

# Regression (requires funded testnet wallets in .env)
node scripts/fund_usdc_testnet.mjs
bash scripts/regression_test.sh
```

The regression suite uses live Stellar testnet contracts, live Horizon/RPC reads, and real testnet USDC/EURC SAC balances. It does not seed fake balances; fund the eligible wallet first if SAC transfers fail for insufficient balance.

## Deployment

- **Frontend:** Vercel — root `app/`, see `app/.env.example`
- **Backend:** Render — `render.yaml`, root `issuer-service/`

Contract IDs for testnet are in `deployments.json`. Set all required `VITE_*` and issuer env vars in your hosting dashboards; never commit `.env`. Privacy-pool and ASP membership IDs are intentionally unset in the frontend template because those contracts are not wired into the settlement path.

## Verification

```bash
npm test
cd app && npm run build
cd ..
bash scripts/regression_test.sh
bash scripts/build_contracts.sh
bash scripts/verify_passkey_auth_encoding.sh
bash scripts/verify-tx-events.sh 46c8471c5a536940443f8f172e9193603b87743317ee6ad61b34e712fe1b16f0
```

`npm run test:e2e` requires Playwright browser system dependencies. On Linux hosts, install them with `npx playwright install-deps chromium`; without sudo the suite is blocked by missing `libnspr4.so`.

## Security

- No secrets in git — use `.env.example` templates only
- Testnet deployment — not production mainnet
- Revocation and nullifier replay protection enforced on-chain

## License

See repository license file if present; hackathon / evaluation use unless otherwise specified.
