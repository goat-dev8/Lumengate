# Lumengate — Final Implementation Status Report

**Date:** 2026-06-27  
**Baseline commit:** `3e0ea77`  
**Network:** Stellar Soroban testnet  
**Authoritative architecture:** [`docs/CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md)

This report reflects **verified production testing** including USDC private transfer  
[`e2bfbd286c68f080669f4d655d3435879f89a4b2de219de023f7197daaec6efe`](https://stellar.expert/explorer/testnet/tx/e2bfbd286c68f080669f4d655d3435879f89a4b2de219de023f7197daaec6efe).

---

## Executive summary

The **core privacy-compliance settlement path is working end-to-end on testnet**: passport issuance → local ZK proof → passkey authorization → scoped USDC transfer → on-chain nullifier spend → receipt generation.

Two passkey prompts on Send and passport renewal after settlement are **intentional architecture**, not bugs (evidence in [§ Production behavior analysis](#production-behavior-analysis)).

---

## Production behavior analysis

### Observation 1: Two passkey approvals on Send

**Verdict: INTENTIONAL**

**Evidence:**

1. Settlement uses a **two-transaction pattern** when the proof is not yet bound:
   - Tx 1: `SessionStore.bind_session_proof`
   - Tx 2: `ComplianceSacAdmin.transfer_compliant` (or equivalent)

   Code: `AppContext.signAndSubmitSettlement()` lines ~1614–1665.

2. Verify **Authorize with passkey** binds the **RWA-scoped** proof (`asset_id=1`) via `bindSessionProofIfNeeded`.

3. Send generates a **USDC-scoped** proof (`asset_id=2`) via `ensureProofForAsset('usdc')`. This proof has a **different nullifier and different proof digest** from the RWA proof.

4. `isProofBoundLocally(proof)` and `isSessionProofBoundOnChain` check the **specific proof digest**. USDC proof is not bound by RWA bind → Send requires bind + settle = **2 passkey steps**.

5. Stellar smart-account auth expects `CompliancePolicy.enforce()` to read session-bound proof during `__check_auth` — binding before settlement matches Stellar `__check_auth` tutorials (SessionStore pattern).

**User journey passkey count (typical USDC send):**

| Stage | Passkey prompts | Purpose |
|-------|-----------------|---------|
| Verify → Authorize | 1 | Bind RWA proof |
| Send → Processing | 2 | Bind USDC proof + settle |

Total: **3 passkey ceremonies** for first USDC send after Verify (expected).

**UX debt:** Send UI may still show “Processing / Passkey step 2” briefly after tx confirms (loading state not cleared). Transaction succeeded on-chain — cosmetic desync only.

---

### Observation 2: Passport “Used” / renewal after settlement

**Verdict: INTENTIONAL (anti-replay)**

**Evidence:**

1. **Nullifier derivation** (client): `scopedNullifierDecimal(note_secret, policy_id, asset_id, action_id)` — `app/src/lib/assetScope.ts`.

2. **On-chain spend** (contract): After successful verify inside transfer, `PolicyVerifier` sets  
   `spent_key(policy_id, asset_id, action_id, nullifier) = true` — `contracts/policy_verifier/src/lib.rs`.

3. **Same note_secret → same USDC nullifier.** Once spent, that tuple cannot be reused. A new settlement requires a new `note_secret` from `POST /credential`.

4. **Lifecycle sync:** `syncProofLifecycleOnChain` reads `is_nullifier_spent` for the proof’s scope — returns `lifecycle: 'consumed'` with renewal message — `app/src/lib/proofLifecycle.ts`.

5. **UI:** `ProofLifecyclePanel`, Verify copy “Your previous passport was used… Request a new passport” — `VerifyPage.tsx`, `beginProofRecovery()` in `AppContext.tsx`.

**Why document as intentional:**

- ZK systems require **nullifier uniqueness** to prevent double-spend of eligibility without revealing identity.
- Scoped nullifiers allow **one settlement per asset class per passport issuance** (RWA=1, USDC=2, EURC=3).
- Product choice: after any settlement, guide user through **full passport renewal** rather than per-slot UI (**see KNOWN LIMITATIONS**).

**Architectural nuance:** If user sends USDC only, EURC scope nullifier may still be unspent on-chain. The UI does not currently offer “send EURC without renewing” from Verify — user could attempt EURC from Send with `ensureProofForAsset('eurc')` before lifecycle marks consumed. Post-settlement UI pushes renewal for clarity.

---

## Status categories

### DONE

| Area | Evidence |
|------|----------|
| Passkey smart account creation | `createSmartAccount`, `smart-account-kit`, IndexedDB |
| Passkey-only settlement | `signAndSubmitSettlement` — no Freighter on settle |
| Session proof binding | SessionStore + CompliancePolicy enforce path |
| Two-tx bind + settle | Verified tx `e2bfbd28…` + receipt timeline |
| Browser ZK proving (UltraHonk) | `SyncUltraHonkBackend`, ~30s prove |
| COOP/COEP on Vercel | `app/vercel.json` |
| CRS preload | `preloadCrsFromOrigin()` |
| Dynamic credentials (issuer) | `POST /credential`, walletField-derived commitment |
| Policy-independent Merkle salt | `credentialCommitment.js` — accredited + general share root |
| Registry root sync | `/registry/sync-root`, `/roots?sync=1`, client polling |
| Scoped nullifiers (6 public inputs) | Circuit + PolicyVerifier + client asset scopes |
| USDC private send via SAC admin | `buildUsdcTransferTransaction` |
| EURC send path + testnet SAC | `buildEurcTransferTransaction`, faucet |
| Testnet faucet (USDC/EURC/XLM/treasury) | `issuer-service/lib/faucet.js` |
| Passkey ceremony serial queue | `passkeyCeremony.ts` |
| Passkey deadlock fix | Removed outer ceremony wrap in submit |
| Session persistence (wallet + passkey) | `session.ts`, disconnect preserves passkey |
| Receipt generation | `proofReceipt.ts`, Compliance page |
| Nullifier spent in receipt | On-chain check + timeline |
| Issuer on Render + app on Vercel | Production URLs live |
| Marketplace offerings from issuer | `/offerings` |
| Proof lifecycle (ready/consumed/invalid) | `proofLifecycle.ts` |
| Scope nullifier pre-check before send | `scopeNullifier.ts` |

---

### PARTIALLY DONE

| Area | Gap |
|------|-----|
| Per-asset passport slots UX | On-chain scopes work; UI treats passport as fully consumed after one send |
| Send page loading state | Tx confirmed but button may show “Processing” briefly |
| Verify → Send proof reuse | RWA bind does not cover USDC — by design, but copy could explain 2 passkey steps on Send |
| Regression CLI | 29 pass / 3 fail (no passkey bind in CLI path) per master plan |
| Passkey E2E in CI | Not automated |
| OpenZeppelin relayer | Optional env; not required for current prod path |
| Design system migration | Lovable visual target — presentation layer in progress per execution plan |
| Multi-user credential registry | Single global root — mitigated by sync, not fixed at contract level |
| Accredited vs General policy | Same Merkle leaf; policy affects prover min/max jurisdiction only |

---

### NOT DONE

| Area | Notes |
|------|-------|
| Mainnet deployment | Testnet only — explicit |
| Privacy pool / ASP in default path | Env vars unset intentionally |
| Cross-browser passkey matrix | Not measured |
| Bind tx hash always in session receipt | Works when bind occurs; not all flows persist early |
| Sidebar live ledger footer | Master plan P2 |
| Automated passkey regression in `regression_test.sh` | CLI uses G-wallet path |
| Multi-leaf CredentialRegistry contract | Would remove global root overwrite class |

---

### TECHNICAL DEBT

| Item | Priority |
|------|----------|
| Global single Merkle root on CredentialRegistry | High — architectural |
| In-memory `proofBindCache` (lost on refresh) | Medium — re-bind on chain check |
| Duplicate `VITE_PASSKEY_RP_ID` in `.env.example` | Low — cleanup template |
| Many stale root-level markdown reports | Medium — consolidate to `docs/` |
| `ARCHITECTURE_TRUTH.md` was outdated until this sync | Addressed |
| Prover ~30s cold start | Medium — pre-warm on Verify complete |
| Render cold start 502/503 | Low — retries exist |

---

### KNOWN LIMITATIONS

| Limitation | Impact |
|------------|--------|
| Single global credential root | Last passport issuance overwrites chain root until sync |
| One nullifier per (policy, asset, action) per note_secret | Renewal required for repeat USDC sends |
| Amount/recipient not private | Public Stellar ledger |
| Testnet EURC not Circle mainnet | Demo SAC only |
| Freighter still needed for funding | Passkey cannot pay classic fees without relayer |
| UI “Passport used” after one asset send | May overstate renewal need if other scopes unused |

---

### SECURITY OBSERVATIONS

| Topic | Assessment |
|-------|------------|
| Nullifier replay protection | **Strong** — on-chain persistent spent map with scope |
| Session proof binding | **Strong** — CompliancePolicy reads SessionStore |
| PII in ZK private inputs | **Strong** — not in public inputs |
| Issuer Ed25519 commitment signing | Implemented — self-check on issue |
| Credential fixture template | Static JSON merged with dynamic fields — issuer holds key |
| CORS | Restricted to configured origin |
| Revoke API | Key-protected |
| Passkey RP ID binding | Must match domain — misconfig breaks auth |
| Admin key on issuer | Can sync roots, faucet — testnet only |
| Smart account policy staleness check | `isSmartAccountPolicyStaleOnChain` blocks superseded accounts |

---

## Documentation synchronization (this task)

| Document | Action |
|----------|--------|
| `docs/CURRENT_ARCHITECTURE.md` | **Created** — implementation truth |
| `docs/ENVIRONMENT.md` | **Created** — env reference |
| `docs/IMPLEMENTATION_STATUS_REPORT.md` | **Created** — this file |
| `docs/ARCHITECTURE_TRUTH.md` | **Rewritten** — points to current architecture |
| `docs/PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md` | **§34 appended** — post-freeze updates |
| `README.md` | **Updated** — current flows |
| `LUMENGATE_MASTER_EXECUTION_PLAN.md` | **Header + appendix** — doc sync note |

---

## Recommended next steps (code — not in this task)

1. Clear Send loading state immediately when settlement hash returns.
2. UX copy: explain Verify bind (RWA) vs Send bind (asset-scoped) and expected passkey count.
3. Optional: pre-bind USDC proof after RWA authorize to reduce Send prompts.
4. Contract: multi-leaf credential registry (future).
5. CI: passkey smoke test with Playwright.

---

*Report generated as part of documentation-first sync — no code changes in this pass.*
