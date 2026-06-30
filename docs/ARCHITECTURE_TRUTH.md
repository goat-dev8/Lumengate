# Lumengate Architecture Truth (code-backed)

**Status:** Synchronized 2026-06-27 · commit `3e0ea77`

> **This file is a short index.** The full implementation truth lives in  
> **[`docs/CURRENT_ARCHITECTURE.md`](./CURRENT_ARCHITECTURE.md)** and  
> **[`docs/IMPLEMENTATION_STATUS_REPORT.md`](./IMPLEMENTATION_STATUS_REPORT.md)**.

Older copies of this document (pre-2026-06-27) incorrectly stated that Freighter signs settlements and passkeys are not wired. **That is obsolete.** Production uses passkey smart accounts for all compliant settlements.

---

## Quick facts

| Question | Answer |
|----------|--------|
| Who signs settlement? | **Passkey** via smart account (`C…`) |
| Who funds the smart account? | **Freighter** `G…` wallet |
| How many public ZK inputs? | **6** (root, rev_root, policy, asset, action, nullifier) |
| One proof = one send? | **One nullifier per asset scope** per `note_secret` |
| Two passkey prompts on Send? | **Yes**, when USDC proof must be bound then settled |
| Renewal after send? | **Intentional** — nullifier anti-replay |
| Prover location | **Browser** (UltraHonk, COOP/COEP required) |
| Issuer role | Credentials + root sync — **not** settlement signer |

---

## Lifecycle (summary)

```
G-wallet connect → fund C-address → request passport (issuer)
  → confirm eligibility (local ZK, RWA scope)
  → authorize passkey (bind RWA proof to SessionStore)
  → send USDC (generate USDC scope proof → bind → transfer_compliant)
  → nullifier spent → renew passport for next USDC send
```

---

## On-chain source of truth

| State | Contract method |
|-------|-----------------|
| Nullifier spent | `PolicyVerifier.is_scoped_nullifier_spent` |
| Session proof bound | `SessionStore` read via `readSessionProofBound` |
| Merkle root | `CredentialRegistry` (global single root) |

---

## See also

- [`docs/PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md`](./PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md) — auth bugs, ADRs, deployment
- [`docs/ENVIRONMENT.md`](./ENVIRONMENT.md) — all env vars
- [`README.md`](../README.md) — quick start
