# Lumengate — Current Architecture (Implementation Truth)

**Document class:** Single source of truth for *what is deployed and running today*  
**Baseline commit:** `3e0ea77` (2026-06-27)  
**Network:** Stellar Soroban testnet only — **not mainnet**  
**Production URLs:** Frontend `https://lumengatex.vercel.app` · Issuer `https://lumengate-issuer.onrender.com`

This document supersedes outdated claims in older reports (especially `docs/ARCHITECTURE_TRUTH.md` pre-2026-06-27). Every statement below maps to repository code, deployed contract IDs, or verified testnet transactions unless marked **LIMITATION**.

---

## Table of Contents

1. [System overview](#1-system-overview)
2. [Wallet vs passkey vs smart account](#2-wallet-vs-passkey-vs-smart-account)
3. [End-to-end user flow](#3-end-to-end-user-flow)
4. [ZK eligibility & scoped nullifiers](#4-zk-eligibility--scoped-nullifiers)
5. [Session proof binding (two-transaction settlement)](#5-session-proof-binding-two-transaction-settlement)
6. [Credential registry & root synchronization](#6-credential-registry--root-synchronization)
7. [Issuer service API](#7-issuer-service-api)
8. [Prover (browser)](#8-prover-browser)
9. [Passkey ceremony & WebAuthn](#9-passkey-ceremony--webauthn)
10. [Session persistence & disconnect](#10-session-persistence--disconnect)
11. [Settlement assets (RWA, USDC, EURC)](#11-settlement-assets-rwa-usdc-eurc)
12. [Receipt architecture](#12-receipt-architecture)
13. [Funding & faucet](#13-funding--faucet)
14. [Deployment topology](#14-deployment-topology)
15. [Environment variables](#15-environment-variables)
16. [Verified production anchors](#16-verified-production-anchors)
17. [Related documents](#17-related-documents)

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Browser (Vercel)                                                        │
│  Freighter/G-wallet ── fund XLM/USDC/EURC ── fee payer only             │
│  WebAuthn passkey ─── authorize smart account (C-address)               │
│  Noir + UltraHonk ─── prove eligibility locally (~30s)                  │
└───────────────┬─────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐     ┌──────────────────────────────────────┐
│ Issuer (Render)           │     │ Soroban testnet                      │
│ Ed25519 credentials       │────▶│ CredentialRegistry (global Merkle    │
│ Dynamic prover inputs       │     │ root), PolicyVerifier (UltraHonk +   │
│ Registry root sync          │     │ scoped nullifiers), SessionStore,    │
│ Faucet, disclosures         │     │ CompliancePolicy, ComplianceSacAdmin │
└───────────────────────────┘     └──────────────────────────────────────┘
```

**Privacy model:** Eligibility attributes (accreditation, jurisdiction, sanctions, age) stay in ZK private inputs. On-chain public inputs are: Merkle root, revocation root, policy ID, asset ID, action ID, nullifier. Transfer amount, `from`, and `to` remain visible on the public Stellar ledger (compliant settlement, not a privacy pool).

---

## 2. Wallet vs passkey vs smart account

| Role | Technology | Address | Used for |
|------|------------|---------|----------|
| Funding wallet | Stellar Wallets Kit (Freighter, xBull, …) | `G…` | Onboarding, trustlines, funding smart account with USDC/EURC/XLM |
| Passkey | WebAuthn secp256r1 | credential ID in browser | Signs `AuthPayload` for smart account via `smart-account-kit` |
| Settlement account | `LumengateSmartAccount` WASM | `C…` | **All compliant settlements** — USDC, EURC, RWA, marketplace |

**Passkey-only settlement is implemented.** Freighter does **not** sign settlement transactions. Freighter may still sign classic funding operations (wallet → smart account).

Implementation: `app/src/lib/smartAccount.ts`, `app/src/context/AppContext.tsx` (`signAndSubmitSettlement`, `submitWithSmartAccount`).

---

## 3. End-to-end user flow

### Verify (Passport)

| Step | User action | System behavior |
|------|-------------|-----------------|
| 0 | Create passkey smart account | Deploy `C…` account, install CompliancePolicy + SessionStore context rules |
| 1 | Fund smart account | Freighter funds `C…` via USDC/EURC/XLM (or testnet faucet) |
| 2 | Request passport | `POST /credential` → issuer builds commitment, syncs Merkle root, returns `note_secret` + prover inputs |
| 3 | Confirm eligibility | Registry sync → local UltraHonk proof for **RWA scope** (asset_id=1) |
| 4 | Authorize with passkey | `bind_session_proof` on SessionStore (tx 1) — optional if already bound for this proof digest |

### Send (Private transfer)

| Step | User action | System behavior |
|------|-------------|-----------------|
| 1 | Enter amount/recipient | Compliance checks (sanctions UI, allowlist) |
| 2 | Send privately | If no USDC-scoped proof: registry sync → generate USDC proof locally (asset_id=2) |
| 3 | Passkey step 1 (if needed) | Bind **USDC-scoped** proof to SessionStore — different digest from RWA proof |
| 4 | Passkey step 2 | `ComplianceSacAdmin.transfer_compliant` — spends USDC scoped nullifier on-chain |
| 5 | Receipt | Session bind tx + settlement tx linked in receipt UI |

**Important:** Verify binds the **RWA-scoped** proof. Send generates and binds a **USDC-scoped** proof. That is why users typically see **two passkey prompts on Send** even after authorizing on Verify.

### After settlement

- USDC scoped nullifier is permanently marked spent in `PolicyVerifier`.
- UI shows **Passport used / Renewal needed**.
- User must **Request new passport** (new `note_secret`) before the next USDC settlement.
- See [§4](#4-zk-eligibility--scoped-nullifiers) for per-asset slot semantics.

---

## 4. ZK eligibility & scoped nullifiers

### Public inputs (6)

| Index | Field | Visibility |
|-------|-------|------------|
| 0 | Eligibility Merkle root | Public |
| 1 | Revocation root | Public |
| 2 | Policy ID | Public |
| 3 | Asset ID | Public |
| 4 | Action ID | Public |
| 5 | Nullifier | Public |

### Asset scopes (client)

Defined in `app/src/lib/assetScope.ts`:

| Asset | asset_id | action_id | Use |
|-------|----------|-----------|-----|
| RWA / treasury | 1 | 1 | Marketplace treasury units |
| USDC | 2 | 1 | Private USDC send |
| EURC | 3 | 1 | Private EURC send |

### Nullifier derivation

```
nullifier = Poseidon2(note_secret, policy_id, asset_id, action_id)
```

Same `note_secret` produces **different nullifiers per scope**. Each `(policy_id, asset_id, action_id, nullifier)` tuple can be spent **once** on-chain.

On-chain enforcement: `contracts/policy_verifier/src/lib.rs` — `spent_key(policy_id, asset_id, action_id, nullifier)`.

### Passport renewal after settlement — **INTENTIONAL**

After a successful USDC send:

1. `PolicyVerifier` marks the USDC scoped nullifier spent (anti-replay).
2. The same `note_secret` always derives the **same** USDC nullifier — it cannot be reused.
3. Issuing a new passport (`POST /credential`) generates a fresh `note_secret` and fresh nullifiers for all scopes.

**Why the UI says “Passport used” for the whole passport:** Product UX treats one settlement as consuming the active proof session. Recovery flow clears credential and requires **Request new passport**. Architecturally, unspent scopes (e.g. EURC if only USDC was sent) could still be provable from the same credential — the UI does not expose per-slot renewal today (**LIMITATION**).

Evidence: `app/src/lib/scopeNullifier.ts`, `app/src/lib/proofLifecycle.ts`, `contracts/policy_verifier/src/lib.rs`.

---

## 5. Session proof binding (two-transaction settlement)

Aligned with Stellar smart-account auth: `CompliancePolicy.enforce()` reads bound proof from `SessionStore` during `__check_auth`; settlement contract spends nullifier.

| Tx | Contract call | Signer | When |
|----|---------------|--------|------|
| 1 | `SessionStore.bind_session_proof` | Passkey smart account | Proof digest not yet bound locally or on-chain |
| 2 | `ComplianceSacAdmin.transfer_compliant` (or RWA/DEX/payroll) | Passkey smart account | Always for settlement |

Implementation: `AppContext.signAndSubmitSettlement()` — computes `passkeySteps` as 1 or 2 based on bind state.

Bind at Verify (`bindSessionProofIfNeeded`) binds the **RWA** proof. Send binds the **asset-scoped** proof used for that transfer.

Local bind cache: `app/src/lib/proofBindCache.ts` (in-memory digest; cleared on new proof generation).

---

## 6. Credential registry & root synchronization

### Contract limitation

`CredentialRegistry` stores a **single global Merkle root** (`set_root` overwrites for all users). Last writer wins on testnet.

### Mitigation (implemented)

| Mechanism | Location | Behavior |
|-----------|----------|----------|
| `POST /registry/sync-root` | `issuer-service/server.js` | Re-assert wallet’s root on-chain without new `note_secret` |
| `GET /roots?walletField=&sync=1` | issuer fallback | Same sync via query params |
| `ensureRegistryRootForWallet` | `app/src/lib/registrySync.ts` | Calls issuer before prove/send |
| `waitForCredentialRootsReady` | `app/src/lib/registrySync.ts` | Polls chain up to ~30s |
| Policy-independent salt | `issuer-service/lib/credentialCommitment.js` | One commitment per wallet; policy affects prover thresholds only |

Client patches stored `credential.root` after successful sync (`AppContext.tsx`).

---

## 7. Issuer service API

Base: `VITE_ISSUER_SERVICE_URL` (default `https://lumengate-issuer.onrender.com`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/roots` | Read on-chain Merkle roots; `?walletField=&policyKey=&sync=1` to sync |
| POST | `/registry/sync-root` | Sync wallet root without re-issuing passport |
| POST | `/credential` | Issue passport (commitment, note_secret, prover inputs) |
| GET | `/policies` | Eligibility policy list |
| GET | `/offerings` | Marketplace offerings |
| POST | `/faucet/claim` | Testnet USDC/EURC/XLM/treasury faucet |
| GET | `/faucet/status` | Faucet cooldown status |
| POST | `/smart-account/passkeys` | Register passkey signer (admin/issuer path) |
| POST | `/revoke` | Credential revocation (API key) |
| POST | `/disclose` | Auditor selective disclosure |

---

## 8. Prover (browser)

| Topic | Implementation |
|-------|----------------|
| Circuit | Noir eligibility (`circuits/`) |
| Backend | `SyncUltraHonkBackend` — main-thread WASM (replaces Comlink worker that hung under COOP/COEP) |
| CRS preload | `preloadCrsFromOrigin()` in `app/src/lib/prover.ts` |
| Cross-origin isolation | Required for `SharedArrayBuffer`; headers in `app/vite.config.ts` + `app/vercel.json` |
| COOP | `same-origin` |
| COEP | `credentialless` |
| Warmup | Prover initializes on first `generateProof()`; ~30s typical |

---

## 9. Passkey ceremony & WebAuthn

| Topic | Implementation |
|-------|----------------|
| Serial queue | `app/src/lib/passkeyCeremony.ts` — prevents overlapping WebAuthn prompts |
| Deadlock fix | `submitWithSmartAccount` does **not** wrap outer `runPasskeyCeremony` (kit callbacks use same queue) |
| RP ID | `VITE_PASSKEY_RP_ID` must match production hostname |
| Kit | `smart-account-kit` + vendored bindings in `app/vendor/` |
| Simulation source | OpenZeppelin kit deployer key (`resolvePasskeySimulationSource`) |

Stellar alignment: Smart account `__check_auth` → WebAuthn verifier → CompliancePolicy (see Stellar docs clone `check-auth-tutorials.mdx`).

---

## 10. Session persistence & disconnect

| Storage key | Contents |
|-------------|----------|
| `lumengate.session.v2` | Per G-wallet: credential, proof, lifecycle, smart account, receipts |
| `lumengate.passkey.v1` | Passkey smart account session (survives wallet disconnect) |
| `lumengate.wallet.last` | Last connected G-wallet for silent restore |
| IndexedDB | `smart-account-kit` credential storage |

**Disconnect behavior:** Clears G-wallet session but **preserves passkey session** when present — user stays on smart account without Freighter connected (`AppContext.disconnect`).

---

## 11. Settlement assets (RWA, USDC, EURC)

| Asset | Builder | Contract path |
|-------|---------|---------------|
| USDC | `buildUsdcTransferTransaction` | `ComplianceSacAdmin.transfer_compliant` → testnet USDC SAC |
| EURC | `buildEurcTransferTransaction` | Same admin → deployer-issued EURC SAC (testnet) |
| RWA | `buildTransferTransaction` | `RwaToken.transfer` via adapter |

SAC addresses from env / `deployments.json`. Classic trustlines still required for recipients.

---

## 12. Receipt architecture

Receipt ties together:

1. **Session bind tx** — `receiptTransactions.sessionBind`
2. **Settlement tx** — `receiptTransactions.transfer`
3. **Proof hash** — derived from UltraHonk proof bytes
4. **Nullifier spent check** — `readNullifierSpent` with asset scope
5. **Timeline UI** — Verify → bind → settle → eligibility badges

Implementation: `app/src/lib/proofReceipt.ts`, `CompliancePage.tsx`.

---

## 13. Funding & faucet

| Source | Path |
|--------|------|
| Freighter → smart account | `fundSmartAccountUsdc/Eurc/Xlm` in AppContext |
| Testnet faucet | Issuer `POST /faucet/claim` — USDC, EURC, XLM, treasury |
| Marketplace treasury | Separate offering settlement addresses |

EURC on testnet is **deployer-issued SAC**, not Circle mainnet EURC (`VITE_EURC_NOTE` in env).

---

## 14. Deployment topology

| Component | Host | Config |
|-----------|------|--------|
| Frontend | Vercel (`app/`) | `app/vercel.json`, `VITE_*` env |
| Issuer | Render (`issuer-service/`) | `render.yaml` |
| Contracts | Testnet | `deployments.json`, admin keys in Render env |

Render free tier cold starts: issuer may return 502/503 — client retries (`issuerFetch` in `config.ts`).

---

## 15. Environment variables

See **`docs/ENVIRONMENT.md`** for the full matrix (frontend + issuer + scripts).

Critical production vars:

- `VITE_PASSKEY_RP_ID` / `VITE_PASSKEY_ORIGIN` — must match Vercel domain
- `VITE_SESSION_STORE_ID`, `VITE_COMPLIANCE_POLICY_ID`, `VITE_WEBAUTHN_VERIFIER_ID`
- `VITE_ISSUER_SERVICE_URL`
- Issuer: `ISSUER_ED25519_SECRET`, `CONTRACT_ADMIN_SECRET_KEY`, `CORS_ORIGIN`

---

## 16. Verified production anchors

| Anchor | Value |
|--------|-------|
| Commit | `3e0ea77` |
| USDC settlement (user-verified) | `e2bfbd286c68f080669f4d655d3435879f89a4b2de219de023f7197daaec6efe` |
| Earlier settlement reference | `46c8471c5a536940443f8f172e9193603b87743317ee6ad61b34e712fe1b16f0` |
| SessionStore | `CBNDCK32HPC5ADIYF7ZP4R4Q4PIXH3SFLITV66DXDIG4THYHWKO7IPAI` |
| CompliancePolicy | `CDAQ5KFAFAO5F33AD62V7RRJO2PDLXDKRPGLUZN72Z7KGDXWIEBBLJXF` |
| WASM hash | `df911f9fd998495cb41bd39f4254b70acfde8dc6e86f230fb139481e3247b969` |

---

## 17. Related documents

| Document | Role |
|----------|------|
| **`docs/CURRENT_ARCHITECTURE.md`** (this file) | Implementation truth |
| **`docs/IMPLEMENTATION_STATUS_REPORT.md`** | DONE / PARTIAL / DEBT status |
| **`docs/PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md`** | Passkey auth deep dive + ADRs |
| **`docs/ENVIRONMENT.md`** | Env var reference |
| **`README.md`** | Quick start |
| **`LUMENGATE_MASTER_EXECUTION_PLAN.md`** | UX/design migration plan (presentation layer) |
| **`deployments.json`** | Contract IDs |

---

*Last synchronized: 2026-06-27 — commit `3e0ea77`*
