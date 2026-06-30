# OpenZeppelin Stellar Security Detectors Report

**Generated:** 2026-06-23  
**Scope:** Lumengate Soroban workspace (`contracts/*`)  
**Tooling:** Manual static review aligned with OpenZeppelin Stellar Contracts v0.7.2 patterns + `cargo build` / unit tests

## Summary

| Contract | AccessControl | Reentrancy risk | Auth path | Notes |
|----------|---------------|-----------------|-----------|-------|
| IssuerRegistry | Yes | Low | Role-gated | issuer_admin on add/revoke |
| CredentialRegistry | Yes | Low | Role-gated | root_admin + note_root |
| PolicyVerifier | Yes | Low | External verifier routing | nullifier replay protected |
| RwaAdapter | Yes | Low | Read-only verify | adapter_admin |
| ComplianceSacAdmin | Yes | Low | proof-gated transfer | SAC admin roles |
| AuditorRegistry | Yes | Low | viewing-key hash | record_disclosure events |
| LumengateSmartAccount | OZ smart account | Low | __check_auth + policies | passkey + compliance |
| CompliancePolicy | Policy trait | Low | enforce on auth | session proof binding |
| WebAuthnVerifier | Stateless | None | verify only | shared OZ verifier pattern |
| SessionKeyPolicy | Policy trait | Low | spending limit | ledger window |
| GovernanceTimelock | Yes + Timelock | Low | proposer/executor | 17280 ledger delay |

## Findings

No critical unresolved issues in deployed testnet configuration. Residual operational items:

1. Rotate demo auditor viewing keys to per-auditor secrets in production.
2. Grant sensitive roles to `governance_timelock` once multisig addresses are supplied.
3. Re-run this report after each WASM upgrade.

## Evidence

- Workspace build: `scripts/build_contracts.sh` (14 packages)
- Regression: `scripts/regression_test.sh`
- Threat model: `THREAT_MODEL.md`
