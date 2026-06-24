# Production Bug Report

**Audited:** 2026-06-23  
**Frontend:** https://lumengatex.vercel.app  
**Backend:** https://lumengate-issuer.onrender.com  

Audit scope: deployed environments only (not local regression scripts).

---

## P0 — Credential issuance broken

| Flow | Symptom | Root cause | Fix |
|------|---------|------------|-----|
| Verify → Request credential | `POST /credential` returns 500 | Render backend shells out to `nargo test nullifier_for_note`; `nargo` not installed in production PATH | Replace nargo Poseidon2 ops with pure JS `@zkpassport/poseidon2` in `issuer-service/lib/poseidonFields.js` |

**Evidence (pre-fix):**
```json
{"error":"Failed to build prover inputs","detail":"Command failed: nargo test nullifier_for_note --show-output\n/bin/sh: 1: nargo: not found\n"}
```

**Blocked downstream flows:** Proof generation, passport activation, Send settlement, auditor disclosure.

---

## P1 — Note Merkle root path bug (local + would affect production note sync)

| Flow | Symptom | Root cause | Fix |
|------|---------|------------|-----|
| Issuer note commitment append | `computeNoteRoot` invoked missing script | `noteMerkle.js` referenced non-existent `issuer-service/lib/compute_note_root.js` | Inline `computeNoteRootFromLeaves` via `poseidonFields.js` |

---

## P1 — UX / product clarity

| Page | Issue | Fix |
|------|-------|-----|
| Verify | Raw JSON error at bottom of page | Friendly error banner + `friendlyIssuerError()` mapping |
| Verify | 2-step form, technical jargon (RP ID, Issuer attestation) | 5-step guided onboarding; technical labels hidden unless developer mode |
| Home | Contract IDs and V3 infrastructure hashes visible by default | Hidden behind developer mode toggle |
| Home | Footer copy referenced "Ethereum credentials" | Updated to issuer attestation → ZK → Stellar |
| Admin | Raw Merkle roots and contract IDs exposed to all users | Developer mode gate — narrative default |
| Auditor | Raw contract IDs front and center | Privacy guarantee cards default; contracts in developer mode |
| Send | No explanation of privacy vs auditor visibility | Added "What is protected" / "What auditors can verify" panels |
| Send | Empty state linked to `/app/prove` (orphan route) | Link to `/app/verify` |

---

## P2 — Environment / deployment risks

| Item | Risk | Action needed |
|------|------|---------------|
| Render env `CREDENTIAL_REGISTRY_ID` | May reference stale contract if not updated after redeploy | Confirm Render env matches latest `deployments.json` |
| Vercel `VITE_PASSKEY_RP_ID` | Must be `lumengatex.vercel.app` for passkeys | Confirm in Vercel project settings |
| Note root on-chain sync | Requires `stellar` CLI on Render (often absent) | Non-blocking for credential issuance; note root sync may silently skip |

---

## Production route smoke (pre-fix)

| Route | Status | Notes |
|-------|--------|-------|
| `/` landing | Loads | Marketing narrative present |
| `/app/home` | Loads | Infrastructure cards visible (UX issue) |
| `/app/verify` | Partial | Passkey works; credential fails 500 |
| `/app/send` | Loads | Blocked without proof |
| `/app/auditor` | Loads | Functional for manual JSON paste |
| `/app/admin` | Loads | Exposes raw infrastructure |
| `GET /health` | 200 | Issuer service up |
| `POST /credential` | 500 | nargo not found |

---

## Remaining blockers (post-push verification required)

1. Render redeploy must pick up `poseidonFields.js` + `@zkpassport/poseidon2` dependency
2. Re-test `POST /credential` on production after deploy
3. End-to-end: passkey → credential → proof → send on https://lumengatex.vercel.app
4. Confirm Vercel frontend redeploy with UX changes

---

## Fixes implemented in this iteration

- `issuer-service/lib/poseidonFields.js` — circuit-compatible Poseidon2 without nargo
- Updated `generate_prover_toml.js`, `compute_revocation_root.js`, `compute_note_root.js`, `noteMerkle.js`, `generate_pof_prover_toml.js`
- Verify page 5-step guided flow + friendly errors
- Developer mode toggle across Home, Verify, Admin, Auditor
- Send privacy narrative panels
- Dashboard flow copy fix (remove Ethereum reference)
- Shell tagline: "Compliance layer for Stellar"
