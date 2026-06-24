# Lumengate Recovery Handoff

## Status

The implementation is not a fake or UI-only recovery. The current branch now uses the intended architecture:

- Per-user smart account deployment from the uploaded Lumengate smart-account WASM hash.
- Real WebAuthn/passkey smart-account path through `smart-account-kit`.
- Smart account as settlement owner for RWA, USDC, and EURC flows.
- Asset-scoped nullifiers: `Poseidon(secret, policyId, assetId, actionId)`.
- Passport lifecycle checks scoped by `assetId` and `actionId`.
- RWA, USDC, EURC settlement checks using the smart-account owner path.
- Funding UX for the user's personal smart account.
- Deployment config and env mappings updated away from shared smart-account IDs.

One thing is not fully owner-verified yet: browser end-to-end passkey deployment and settlement on the deployed Vercel app. The local browser smoke test reached wallet connection, but Cursor's browser did not have an unlocked Stellar wallet extension/provider. The app now times out cleanly instead of hanging when no wallet responds.

## What Changed

### Smart Accounts and Passkeys

- Added/rewired `app/src/lib/smartAccount.ts` around `smart-account-kit`.
- Updated `contracts/lumengate_smart_account/src/lib.rs` to match the standard constructor expected by the kit: signers plus policies.
- Uploaded the smart-account WASM to testnet.
- Stored the real account WASM hash in `deployments.json`, `.env`, app env files, and `app/.env.example`.
- Removed stale shared smart-account env references.
- Updated the legacy `scripts/smart_account_bind_session.sh` so it requires an explicit per-user `SMART_ACCOUNT_ID` instead of reading a shared deployment.

### Asset-Scoped Nullifiers

- Updated the Noir eligibility circuit to include `asset_id` and `action_id` public inputs.
- Updated nullifier derivation to include `secret`, `policyId`, `assetId`, and `actionId`.
- Added `app/src/lib/assetScope.ts` with canonical scopes:
  - RWA: `assetId=1`, `actionId=1`
  - USDC: `assetId=2`, `actionId=1`
  - EURC: `assetId=3`, `actionId=1`
- Updated frontend proof generation and validation to use the asset scope.
- Updated issuer helpers and prover generation scripts.
- Kept proof-of-funds compatible with its existing four-public-input circuit by adding a separate two-input policy nullifier helper.

### Contracts

- Redeployed `PolicyVerifier` with scoped settlement nullifier support and legacy PoF support.
- Redeployed/wired:
  - `rwa_token`
  - `rwa_adapter`
  - `compliance_sac_admin`
  - `compliant_dex`
  - `compliant_payroll`
- Enforced asset scope in:
  - `rwa_token`
  - `compliance_sac_admin`
  - `compliant_dex`
  - `compliant_payroll`
- Seeded the new RWA token test eligible balance.
- Re-froze the sanctioned test account on the new RWA token.

### Frontend UX

- Updated `AppContext` to persist per-user smart-account state.
- Smart-account address is now the settlement owner when available.
- Proof generation now happens per asset scope.
- Transfer and marketplace settlement now require the smart account.
- Dashboard and portfolio read the smart-account owner balances.
- Added wallet connection timeout so the UI recovers if no wallet extension responds.
- Replaced stale "wallet signs settlement" copy with passkey smart-account authorization language.

### Deployment and Regression Scripts

- Updated `scripts/deploy_v3_contracts.sh` to upload smart-account WASM and write `VITE_LUMENGATE_SMART_ACCOUNT_WASM_HASH` instead of deploying a shared smart account.
- Updated `scripts/regression_test.sh` to:
  - Use USDC-scoped proofs for USDC, DEX, and payroll paths.
  - Verify smart-account WASM hash instead of shared smart-account ID.
  - Check that shared smart-account env keys are removed.
- Updated `app/.env.example` with the current deployed contract IDs.

## Current Deployed Testnet Values

Use these for Vercel frontend env:

```env
VITE_STELLAR_NETWORK=testnet
VITE_NETWORK=testnet
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_ISSUER_SERVICE_URL=https://lumengate-issuer.onrender.com
VITE_EXPLORER_BASE_URL=https://stellar.expert/explorer/testnet
VITE_ISSUER_REGISTRY_ID=CBOG4MRPEGNFZJJ5QKYOTYPJMDYGZ5E5OOOE3CZKQWADEOK4U6AR36WY
VITE_CREDENTIAL_REGISTRY_ID=CBRAQMKRX3ACWU3R4MZ6HQLFZSCY5BJGALI5AQE27NGKDHCGUSXK7U7F
VITE_POLICY_VERIFIER_ID=CBSWGZFEPQXU2OQGTBACBFZ6UP2SXNKDJAIDMFJE245R3AXOMHXXI5TA
VITE_RWA_TOKEN_ID=CBVUK5UPY5Q3RNGD5ZOPB44FAOZUOJXJWGDAHQJBF3TD2P3XLBHXJR22
VITE_RWA_ADAPTER_ID=CACZ4O3EFBCNUXNSW5ZKPLUVMVU3PJZN4E243PG3I6A3PZP5YVGNDY3C
VITE_COMPLIANCE_SAC_ADMIN_ID=CDZFKXPN7ANNQLPHSQNESW3LVOQK66V53S5Z2XZNRMDTEZEQG5QARRSD
VITE_COMPLIANT_DEX_ID=CBOXJCSH5DZN33FT56O53CSKMI6W5XYV2RFF6CBXTFQQ72L37JNDJT2M
VITE_COMPLIANT_PAYROLL_ID=CD6K6T2JD22E4CNAPGE2Y3Q373L6GJKXZ2UEAX64VCDCGNY45X2ZQNVG
VITE_AUDITOR_REGISTRY_ID=CAS2JXTCUO3LFBAL2JIX2Z6VKSGYB5X6JP6X26SXKK56XT7SB5KEUHCN
VITE_COMPLIANCE_POLICY_ID=CDONRLSIDIT7D5DN2PRQY6SR64FRBZ7MBJP5HCODFAP5M4JZ2USM6HS4
VITE_LUMENGATE_SMART_ACCOUNT_WASM_HASH=68abed18387f0415dcfea23e17fdebac1189bbe8f86eb63c14097bc59f2932c5
VITE_WEBAUTHN_VERIFIER_ID=CAQK36HSHDHLH3XKAP6GTMPCPBFDP362A3V7XUEZRYKCD2LJBW76ACTH
VITE_SESSION_KEY_POLICY_ID=CBMISD65SUNFHDGKT4S3YJJ3INJQ3NRXOZGUDAG235JVQHKWYWWRWFJH
VITE_TIMELOCK_CONTRACT_ID=CC7NP3NISCNFNPUGWE6IZZFP4EPPIFX66HV45KNAW3IC3XJ2DK2W4P2I
VITE_PRIVACY_POOL_ID=CC4ID36B3B2UCKZOTGX2NY3VUI36IXCGHBUUPNDZBYTS7UGNSPIZ5P2A
VITE_ASP_MEMBERSHIP_ID=CBWS5GGCL4Q627GJ4HZ2SL5D2P2NXECFXKEPPTOSXOTR4EA7GTVZZWIH
VITE_POLICY_ID=1
VITE_POLICY_ID_2=2
VITE_AUDITOR_ID=1
VITE_PASSKEY_RP_ID=lumengatex.vercel.app
VITE_PASSKEY_ORIGIN=https://lumengatex.vercel.app
VITE_USDC_ASSET_CODE=USDC
VITE_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
VITE_USDC_SAC_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
VITE_EURC_SAC_ID=CCB5GB2KXRF7H3C5KGRDSA3OWO2BHAI6EVIPMPPUDBI5SAXTGQPE6CVH
VITE_EURC_ISSUER=GA5NJ3H2BQG2Y7SGCHLMSQS3VFDJ236NRUTVF3HQDPKCQED6IN7GYLZK
VITE_MARKETPLACE_SETTLEMENT_ADDRESS=GCAERJ6ED7NTUSPTYFTWZAGESNDMEAAFZV4LSS4DD277LMCAOKZUCQ4R
```

Important: remove these old shared-account vars from Vercel if present:

```env
VITE_LUMENGATE_SMART_ACCOUNT_ID
LUMENGATE_SMART_ACCOUNT_ID
```

Use these for Render issuer-service env where applicable:

```env
NODE_ENV=production
HOST=0.0.0.0
STELLAR_NETWORK_NAME=testnet
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
ISSUER_SERVICE_PORT=3001
CORS_ORIGIN=https://lumengatex.vercel.app
ALLOWED_ORIGIN=https://lumengatex.vercel.app
POLICY_ID=1
POLICY_ID_2=2
ISSUER_ID=2
ISSUER_ETH_ID=2
ISSUER_REGISTRY_ID=CBOG4MRPEGNFZJJ5QKYOTYPJMDYGZ5E5OOOE3CZKQWADEOK4U6AR36WY
CREDENTIAL_REGISTRY_ID=CBRAQMKRX3ACWU3R4MZ6HQLFZSCY5BJGALI5AQE27NGKDHCGUSXK7U7F
POLICY_VERIFIER_ID=CBSWGZFEPQXU2OQGTBACBFZ6UP2SXNKDJAIDMFJE245R3AXOMHXXI5TA
RWA_TOKEN_ID=CBVUK5UPY5Q3RNGD5ZOPB44FAOZUOJXJWGDAHQJBF3TD2P3XLBHXJR22
RWA_ADAPTER_ID=CACZ4O3EFBCNUXNSW5ZKPLUVMVU3PJZN4E243PG3I6A3PZP5YVGNDY3C
COMPLIANCE_SAC_ADMIN_ID=CDZFKXPN7ANNQLPHSQNESW3LVOQK66V53S5Z2XZNRMDTEZEQG5QARRSD
COMPLIANT_DEX_ID=CBOXJCSH5DZN33FT56O53CSKMI6W5XYV2RFF6CBXTFQQ72L37JNDJT2M
COMPLIANT_PAYROLL_ID=CD6K6T2JD22E4CNAPGE2Y3Q373L6GJKXZ2UEAX64VCDCGNY45X2ZQNVG
COMPLIANCE_POLICY_ID=CDONRLSIDIT7D5DN2PRQY6SR64FRBZ7MBJP5HCODFAP5M4JZ2USM6HS4
LUMENGATE_SMART_ACCOUNT_WASM_HASH=68abed18387f0415dcfea23e17fdebac1189bbe8f86eb63c14097bc59f2932c5
WEBAUTHN_VERIFIER_ID=CAQK36HSHDHLH3XKAP6GTMPCPBFDP362A3V7XUEZRYKCD2LJBW76ACTH
SESSION_KEY_POLICY_ID=CBMISD65SUNFHDGKT4S3YJJ3INJQ3NRXOZGUDAG235JVQHKWYWWRWFJH
VITE_USDC_SAC_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
VITE_EURC_SAC_ID=CCB5GB2KXRF7H3C5KGRDSA3OWO2BHAI6EVIPMPPUDBI5SAXTGQPE6CVH
```

Render secret values must be updated from local `.env` or secret manager, not pasted into public logs:

```env
DEPLOYER_SECRET_KEY
CONTRACT_ADMIN_SECRET_KEY
ISSUER_STELLAR_SECRET
ISSUER_ED25519_SECRET
REVOKE_API_KEY
AUDITOR_VIEWING_KEY
```

## Verification Already Run

Passed:

```bash
npm test
npm --prefix app run test
cargo test -p lumengate-smart-account -p policy-verifier -p rwa-token -p compliance-sac-admin -p compliance-policy -p compliant-dex -p compliant-payroll
cargo test --workspace
bb verify --scheme ultra_honk --oracle_hash keccak --vk_path circuits/lumengate/target/vk --proof_path circuits/lumengate/target/proof --public_inputs_path circuits/lumengate/target/public_inputs
stellar contract invoke --id <policy_verifier> --source-account deployer --network testnet -- check --policy_id 1 --proof-file-path circuits/lumengate/target/proof --public_inputs-file-path circuits/lumengate/target/public_inputs
bash scripts/regression_test.sh
```

Regression result:

```text
30 passed, 0 failed
```

Browser smoke result:

- Local Vite app loaded.
- Verify page showed smart-account/passkey onboarding copy.
- Wallet connect state now recovers after timeout when no wallet provider responds.
- Full browser E2E still requires a real unlocked Stellar wallet extension in the browser.

## Owner Test Plan After Vercel and Render Redeploy

1. Redeploy Render issuer service with the updated Render env values.
2. Redeploy Vercel app with the updated Vercel env values.
3. Open the deployed Vercel URL on the same domain as `VITE_PASSKEY_RP_ID` and `VITE_PASSKEY_ORIGIN`.
4. Use an unlocked Stellar testnet wallet with funded XLM.
5. Connect wallet.
6. Create passkey smart account.
7. Confirm a personal smart-account address appears.
8. Fund the smart account with testnet XLM and test assets where needed.
9. Issue passport.
10. Generate RWA proof and invest/settle RWA.
11. Generate USDC proof and send/settle USDC.
12. Generate EURC proof and send/settle EURC.
13. Confirm RWA use does not consume USDC/EURC proof eligibility.
14. Try replaying the same asset/action proof and confirm it is blocked.
15. Check Portfolio balances use the smart-account address, not the wallet address.
16. Check Receipt and Audit pages show the settlement references and nullifier state.

## What Should Be Considered Not Done Until Owner Test

- Real user wallet approval on deployed Vercel.
- Real browser-native WebAuthn prompt on the production domain.
- Real personal smart-account deployment from the user's wallet/passkey.
- Real passkey-authorized production-domain settlement.

The contract, proof, regression, and type-check layers are passing locally and on testnet. The remaining validation is the owner-controlled browser and wallet flow after redeploy.
