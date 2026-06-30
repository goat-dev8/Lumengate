# Lumengate — Environment Variables

**Baseline:** commit `3e0ea77` · testnet only

Never commit real secrets. Templates: `app/.env.example`, `issuer-service/.env.example`.

---

## Frontend (`app/` — Vite `VITE_*`)

Built at compile time on Vercel. Changing vars requires redeploy.

### Network

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_STELLAR_NETWORK` | yes | `testnet` |
| `VITE_NETWORK` | yes | Alias for network label |
| `VITE_STELLAR_RPC_URL` | yes | Soroban RPC |
| `VITE_STELLAR_HORIZON_URL` | yes | Horizon |
| `VITE_NETWORK_PASSPHRASE` | yes | Testnet passphrase |
| `VITE_EXPLORER_BASE_URL` | yes | Stellar Expert base |

### Issuer

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ISSUER_SERVICE_URL` | yes | Render issuer URL |

### Soroban contracts

| Variable | Description |
|----------|-------------|
| `VITE_ISSUER_REGISTRY_ID` | Issuer registry |
| `VITE_CREDENTIAL_REGISTRY_ID` | Global Merkle root registry |
| `VITE_POLICY_VERIFIER_ID` | UltraHonk + nullifier store |
| `VITE_RWA_TOKEN_ID` | RWA token |
| `VITE_RWA_ADAPTER_ID` | RWA adapter |
| `VITE_COMPLIANCE_SAC_ADMIN_ID` | USDC/EURC compliant transfer |
| `VITE_COMPLIANT_DEX_ID` | DEX offering path |
| `VITE_COMPLIANT_PAYROLL_ID` | Payroll offering path |
| `VITE_AUDITOR_REGISTRY_ID` | Auditor disclosures |
| `VITE_COMPLIANCE_POLICY_ID` | Smart account auth policy |
| `VITE_SESSION_STORE_ID` | Session proof binding |
| `VITE_WEBAUTHN_VERIFIER_ID` | Passkey signature verify |
| `VITE_SESSION_KEY_POLICY_ID` | Session key policy (scaffold) |
| `VITE_TIMELOCK_CONTRACT_ID` | Timelock scaffold |
| `VITE_POLICY_ID` | Default policy id (numeric) |
| `VITE_POLICY_ID_2` | Secondary policy |
| `VITE_AUDITOR_ID` | Default auditor id |

Optional (not in settlement path): `VITE_PRIVACY_POOL_ID`, `VITE_ASP_MEMBERSHIP_ID`

### Passkeys

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PASSKEY_RP_ID` | yes | WebAuthn RP ID — **must match Vercel hostname** |
| `VITE_PASSKEY_ORIGIN` | yes | Full origin URL |
| `VITE_LUMENGATE_SMART_ACCOUNT_WASM_HASH` | yes | Deployed account WASM |

### Assets (SAC)

| Variable | Description |
|----------|-------------|
| `VITE_USDC_ASSET_CODE` | `USDC` |
| `VITE_USDC_ISSUER` | Testnet USDC issuer G-address |
| `VITE_USDC_SAC_ID` | USDC SAC contract |
| `VITE_EURC_SAC_ID` | Testnet EURC SAC |
| `VITE_EURC_ISSUER` | Deployer EURC issuer |
| `VITE_EURC_NOTE` | UI disclaimer (not Circle mainnet) |
| `VITE_NATIVE_SAC_ID` | XLM SAC |
| `VITE_MARKETPLACE_SETTLEMENT_ADDRESS` | Demo recipient |

### Optional UI

| Variable | Description |
|----------|-------------|
| `VITE_REFERENCE_VERIFY_TX` | Landing page proof tx |
| `VITE_REFERENCE_TRANSFER_TX` | Landing page transfer tx |
| `VITE_REFERENCE_FREEZE_TX` | Landing page freeze tx |
| `VITE_OPENZEPPELIN_RELAYER_URL` | Gasless deploy (optional) |

---

## Issuer (`issuer-service/` — Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `ISSUER_ED25519_SECRET` | yes | Ed25519 signing key |
| `ISSUER_ID` | yes | Numeric issuer id (default `2`) |
| `ISSUER_REGISTRY_ID` | yes | On-chain issuer registry |
| `CREDENTIAL_REGISTRY_ID` | yes | Credential registry |
| `AUDITOR_REGISTRY_ID` | yes | Auditor registry |
| `CONTRACT_ADMIN_SECRET_KEY` | yes | `set_root`, note root sync, faucet |
| `CONTRACT_ADMIN_PUBLIC_KEY` | recommended | Admin G-address |
| `REVOKE_API_KEY` | yes | Protects `/revoke` |
| `AUDITOR_VIEWING_KEY` | yes | Disclosure API |
| `CORS_ORIGIN` | yes | Vercel origin(s), comma-separated |
| `STELLAR_NETWORK_NAME` | yes | `testnet` |
| `STELLAR_RPC_URL` | yes | Soroban RPC |
| `STELLAR_NETWORK_PASSPHRASE` | yes | Network passphrase |
| `CREDENTIAL_FIXTURE_PATH` | optional | Default `./fixtures/credential.json` |
| `PORT` / `ISSUER_SERVICE_PORT` | optional | Default `3001` |

Faucet may read `VITE_EURC_SAC_ID`, `VITE_USDC_SAC_ID` from env for SAC transfers.

---

## Root `.env` (local dev / scripts)

Used by deploy scripts and regression — not shipped to Vercel. Includes contract admin keys, funded test wallets, `GITHUB_TOKEN` (local only).

---

## Deployment checklist

1. Set all `VITE_*` on Vercel from `app/.env.example` + `deployments.json`
2. Set issuer secrets on Render from `issuer-service/.env.example`
3. Confirm `VITE_PASSKEY_RP_ID=lumengatex.vercel.app` (or your domain)
4. Confirm `CORS_ORIGIN` matches frontend origin
5. Redeploy **both** after issuer API changes (e.g. `/registry/sync-root`)

---

## Removed / deprecated

| Variable | Notes |
|----------|-------|
| Launchtube URLs | Replaced by OpenZeppelin relayer pattern |
| Privacy pool env in default template | Intentionally unset — not in settlement path |
