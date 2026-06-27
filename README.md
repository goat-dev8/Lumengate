# Lumengate

Privacy-preserving compliance for Stellar. Prove eligibility with zero-knowledge proofs, authorize with passkeys, and settle USDC/EURC without putting identity on-chain.

**Network:** Stellar Soroban testnet only (not mainnet).

**Production:** [lumengatex.vercel.app](https://lumengatex.vercel.app) · Issuer API on Render

**Documentation (single source of truth):**

| Doc | Purpose |
|-----|---------|
| [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md) | How the system works today |
| [`docs/IMPLEMENTATION_STATUS_REPORT.md`](docs/IMPLEMENTATION_STATUS_REPORT.md) | DONE / partial / debt / security |
| [`docs/PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md`](docs/PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md) | Passkey auth deep dive |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | All environment variables |

---

## What it does

- **Passkey smart accounts** — WebAuthn-authorized `C…` accounts settle all compliant transfers
- **Issuer service** — Ed25519-signed credentials, dynamic commitments, Merkle root sync, testnet faucet
- **Noir + UltraHonk** — Browser-local eligibility proofs (6 public inputs including scoped nullifier)
- **Soroban contracts** — Policy verifier, credential registry, session store, compliance policy, SAC admin, RWA adapter
- **React app** — Passport → verify → send flow with on-chain receipts

### Typical user flow

1. Create passkey smart account and fund with USDC (Freighter or faucet)
2. **Verify:** Request passport → Confirm eligibility (~30s local proof) → Authorize with passkey
3. **Send:** Enter recipient → Send privately (USDC proof generated if needed) → passkey bind + settle
4. **Receipt:** Session bind tx + settlement tx on Compliance page
5. **Renew:** After send, request new passport for the next USDC settlement (nullifier anti-replay)

**Note:** Verify binds the RWA-scoped proof; Send binds the USDC-scoped proof — expect **two passkey steps on Send** after Verify.

---

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
| `docs/` | Canonical architecture and status docs |

---

## Quick start (local)

### Prerequisites

- Node.js 20+
- Rust + `stellar` CLI
- `nargo` + `bb` (Noir / Barretenberg)
- Playwright browser dependencies for e2e (`npx playwright install-deps chromium`)

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

Local dev serves COOP/COEP headers via Vite (`app/vite.config.ts`) — required for the in-browser prover.

### Contracts & circuits

```bash
for d in contracts/*/; do (cd "$d" && stellar contract build --optimize); done
node scripts/generate_prover_toml.js
bash scripts/build_circuit.sh
node scripts/fund_usdc_testnet.mjs   # if needed
bash scripts/regression_test.sh
```

---

## Deployment

| Component | Host | Config |
|-----------|------|--------|
| Frontend | Vercel — root `app/` | `app/vercel.json`, `VITE_*` |
| Issuer | Render — `render.yaml` | `issuer-service/` env |

After issuer API changes (e.g. `/registry/sync-root`), redeploy **both** Render and Vercel.

Set `VITE_PASSKEY_RP_ID` to your production hostname. See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

---

## Verification

```bash
npm test
cd app && npm run build
bash scripts/regression_test.sh
bash scripts/verify_passkey_auth_encoding.sh
```

Verified testnet settlement example:  
[`e2bfbd286c68f080669f4d655d3435879f89a4b2de219de023f7197daaec6efe`](https://stellar.expert/explorer/testnet/tx/e2bfbd286c68f080669f4d655d3435879f89a4b2de219de023f7197daaec6efe)

---

## Security

- No secrets in git — use `.env.example` templates only
- Testnet deployment — not production mainnet
- Scoped nullifier replay protection enforced on-chain per asset class
- Eligibility attributes remain in ZK private inputs; ledger shows settlement + nullifier only

---

## License

See repository license file if present; hackathon / evaluation use unless otherwise specified.
