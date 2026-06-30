# Lumengate — Verified Test Results

**Generated:** 2026-06-30T20:53:01Z (UTC)  
**Repository root:** `/home/devmo/Lumengate`  
**Network:** Stellar Soroban testnet  
**Prerequisites for full integration pass:** `.env` with funded testnet keys, `stellar` CLI on `PATH`, local issuer on `http://127.0.0.1:3001` (`cd issuer-service && PORT=3001 node server.js`)

---

## Summary

| Suite | Passed | Failed | Skipped | Command |
|-------|-------:|-------:|--------:|---------|
| Rust — Lumengate contracts (17 crates) | 42 | 0 | 0 | see Rust section |
| Rust — UltraHonk verifier | 54 | 0 | 0 | `cargo test -p rs-soroban-ultrahonk -p ultrahonk_soroban_verifier` |
| Integration — shell / on-chain | 71 | 0 | 0 | see Integration section |
| Circuits — Node prove | 1 | 0 | 0 | `node scripts/test_prove_node.mjs 200` |
| Backend — issuer-service | 27 | 0 | 0 | `cd issuer-service && npm test` |
| Frontend — app unit | 12 | 0 | 0 | `cd app && npm test` |
| **Total executed passing tests** | **207** | **0** | **0** | |

**Delta from prior verified run (155 tests):** **+52** new passing tests.

**Stress / manual matrix:** `node scripts/ct_passkey_validation.mjs` — not executed in this run (requires interactive passkey sessions).

---

## Rust — Lumengate contracts

**Command:**

```bash
cargo test -p issuer-registry -p credential-registry -p policy-verifier -p rwa-adapter \
  -p rwa-token -p compliance-sac-admin -p auditor-registry -p compliant-dex \
  -p compliant-payroll -p session-store -p lumengate-confidential-token \
  -p lumengate-confidential-policy -p session-key-policy -p compliance-policy \
  -p governance-timelock -p confidential-verifier -p confidential-auditor
```

**Result:** 42 passed, 0 failed  
**Log:** `/tmp/rust_lumengate_final.log`

| Package | Tests passed | Command |
|---------|-------------:|---------|
| issuer-registry | 4 | `cargo test -p issuer-registry` |
| credential-registry | 3 | `cargo test -p credential-registry` |
| policy-verifier | 5 | `cargo test -p policy-verifier` |
| rwa-adapter | 2 | `cargo test -p rwa-adapter` |
| rwa-token | 4 | `cargo test -p rwa-token` |
| compliance-sac-admin | 3 | `cargo test -p compliance-sac-admin` |
| auditor-registry | 5 | `cargo test -p auditor-registry` |
| compliant-dex | 1 | `cargo test -p compliant-dex` |
| compliant-payroll | 1 | `cargo test -p compliant-payroll` |
| session-store | 5 | `cargo test -p session-store` |
| lumengate-confidential-token | 1 | `cargo test -p lumengate-confidential-token` |
| lumengate-confidential-policy | 2 | `cargo test -p lumengate-confidential-policy` |
| session-key-policy | 2 | `cargo test -p session-key-policy` |
| compliance-policy | 1 | `cargo test -p compliance-policy` |
| governance-timelock | 1 | `cargo test -p governance-timelock` |
| confidential-verifier | 1 | `cargo test -p confidential-verifier` |
| confidential-auditor | 1 | `cargo test -p confidential-auditor` |

**Security properties validated:** issuer authorization/revoke/missing pubkey, credential roots + issuer registry wiring, scoped nullifier independence + eligibility flags + unknown policy errors, RWA freeze + initial unfrozen state + admin mint, session proof storage + overwrite + panic on missing proof, auditor viewing-key registration + disclosure mismatch rejection, CT policy rejects unbound accounts, SAC admin adapter/USDC/EURC wiring, session spending-limit install/update, timelock + compliance-policy + confidential verifier/auditor construction, passport validate failure path on RwaAdapter.

**Crates with 0 unit tests (covered by integration scripts):** lumengate-smart-account, webauthn-verifier.

---

## Rust — UltraHonk verifier (ZK on-chain)

**Command:**

```bash
cargo test -p rs-soroban-ultrahonk -p ultrahonk_soroban_verifier
```

**Result:** 54 passed, 0 failed  
**Log:** `/tmp/rust_zk_final.log`

| Package | Tests passed |
|---------|-------------:|
| rs-soroban-ultrahonk | 9 |
| ultrahonk_soroban_verifier (lib + integration) | 45 |

**Security properties validated:** malformed proof/VK rejection, mutated proof failure, happy-path verify, constructor hardening, transcript determinism.

---

## Integration — shell / on-chain

| Script | Passed | Failed | Skipped | Command |
|--------|-------:|-------:|--------:|---------|
| verify_passkey_auth_encoding.sh | 1 | 0 | 0 | `bash scripts/verify_passkey_auth_encoding.sh` |
| verify_confidential_token.sh | 9 | 0 | 0 | `ISSUER_SERVICE_URL=http://127.0.0.1:3001 bash scripts/verify_confidential_token.sh` |
| ct_integration_test.sh | 2 | 0 | 0 | `bash scripts/ct_integration_test.sh` |
| api_integration_test.sh | 18 | 0 | 0 | `ISSUER_URL=http://127.0.0.1:3001 bash scripts/api_integration_test.sh` |
| regression_test.sh | 34 | 0 | 0 | `curl …/registry/sync-root` then `bash scripts/regression_test.sh` |
| verify_ct_sync.mjs | 7 | 0 | 0 | `ISSUER_SERVICE_URL=http://127.0.0.1:3001 node scripts/verify_ct_sync.mjs` |
| **Subtotal** | **71** | **0** | **0** | |

**Note:** `api_integration_test.sh` against production Render issuer returns **503** on `GET /issuer/2` when `stellar` CLI is unavailable on the host (`spawnSync stellar ENOENT`). Run against local issuer for full pass.

**New API checks in this run:** `GET /relayer/status`, `GET /faucet/status`, `GET /offerings/treasury-fund`.

### Raw output — passkey auth encoding

```
PASS passkey auth payload uses canonical raw map order
```

### Raw output — API integration (tail)

```
=== API tests: 18 passed, 0 failed ===
```

### Raw output — regression (tail)

```
=== Summary: 34 passed, 0 failed ===
```

---

## Circuits — Node prove

**Command:**

```bash
curl -sf -X POST http://127.0.0.1:3001/registry/sync-root \
  -H 'Content-Type: application/json' \
  -d '{"walletField":"200","policyKey":"general-eligibility"}'
node scripts/test_prove_node.mjs 200
```

**Result:** 1 passed, 0 failed  
**Log:** `/tmp/circuit_prove_final.log`

**Validates:** 14592-byte UltraHonk proof, 6 public input fields, witness generation from live issuer credential.

**Note:** First attempt may fail if a prior on-chain tx is still confirming; retry after `sync-root` succeeds.

---

## Backend — issuer-service

**Command:**

```bash
cd issuer-service && npm test
```

**Result:** 27 passed, 0 failed  
**Log:** `/tmp/backend_final.log`

| File | Tests passed |
|------|-------------:|
| policies.test.js | 3 |
| disclose.test.js | 2 |
| relayerRateLimit.test.js | 2 |
| poseidonFields.test.js | 5 |
| credentialCommitment.test.js | 4 |
| ed25519Issuer.test.js | 3 |
| revoke.test.js | 2 |
| offerings.test.js | 4 |
| relayerXdrNormalize.test.js | 2 |

---

## Frontend — app unit

**Command:**

```bash
cd app && npm test
```

**Result:** 12 passed, 0 failed  
**Log:** `/tmp/frontend_final.log`

| File | Tests passed |
|------|-------------:|
| assetScope.test.mjs | 4 |
| assetAmount.test.mjs | 4 |
| credentialProof.test.mjs | 4 |

---

## Reproduction steps (full suite)

```bash
# 1. Start local issuer (separate terminal)
cd issuer-service && PORT=3001 node server.js

# 2. Rust — Lumengate contracts
cargo test -p issuer-registry -p credential-registry -p policy-verifier -p rwa-adapter \
  -p rwa-token -p compliance-sac-admin -p auditor-registry -p compliant-dex \
  -p compliant-payroll -p session-store -p lumengate-confidential-token \
  -p lumengate-confidential-policy -p session-key-policy -p compliance-policy \
  -p governance-timelock -p confidential-verifier -p confidential-auditor

# 3. Rust — UltraHonk
cargo test -p rs-soroban-ultrahonk -p ultrahonk_soroban_verifier

# 4. Backend + frontend
cd issuer-service && npm test
cd ../app && npm test

# 5. Integration (from repo root, issuer running)
bash scripts/verify_passkey_auth_encoding.sh
ISSUER_SERVICE_URL=http://127.0.0.1:3001 bash scripts/verify_confidential_token.sh
bash scripts/ct_integration_test.sh
ISSUER_URL=http://127.0.0.1:3001 bash scripts/api_integration_test.sh
curl -sf -X POST http://127.0.0.1:3001/registry/sync-root \
  -H 'Content-Type: application/json' \
  -d '{"walletField":"200","policyKey":"general-eligibility"}'
bash scripts/regression_test.sh
ISSUER_SERVICE_URL=http://127.0.0.1:3001 node scripts/verify_ct_sync.mjs
node scripts/test_prove_node.mjs 200
```

---

## Remaining untested areas

| Area | Gap |
|------|-----|
| lumengate-smart-account | No Rust unit tests (Webauthn verifier mock required for constructor/auth paths) |
| webauthn-verifier | No Rust unit tests (covered by passkey encoding + regression scripts) |
| compliance-policy enforce | Policy `enforce` path needs SessionStore + RwaAdapter mocks |
| compliant-dex / compliant-payroll settlement | No swap/pay integration in unit tests (regression covers deploy wiring) |
| confidential-verifier / confidential-auditor | Constructor only; VK registration + key rotation untested at unit level |
| governance-timelock | Constructor only; schedule/execute/cancel lifecycle untested |
| session-key-policy enforce | Install/set tested; ledger-window enforcement not unit-tested |
| Frontend UI / Playwright | No browser E2E in automated suite |
| proofLifecycle.ts on-chain sync | `syncProofLifecycleOnChain` requires live RPC (not in Node unit suite) |
| relayerXdrNormalize full realignment | Empty/deployer-key cases only; live Soroban XDR realignment untested without Channels |
| revokeCredential on-chain | API integration optional; full chain revoke path depends on admin keys + stellar CLI |
| ct_passkey_validation.mjs | Manual interactive passkey matrix (10-account lifecycle) |
