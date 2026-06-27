# Lumengate Documentation Index

**Last updated:** 2026-06-27 · commit `3e0ea77`

Read these documents in order for a full picture of the project today.

## Primary (authoritative)

| Document | Description |
|----------|-------------|
| [**CURRENT_ARCHITECTURE.md**](./CURRENT_ARCHITECTURE.md) | Single source of truth — flows, contracts, APIs, deployment |
| [**IMPLEMENTATION_STATUS_REPORT.md**](./IMPLEMENTATION_STATUS_REPORT.md) | DONE / partial / debt / security / production test analysis |
| [**PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md**](./PASSKEY_SMART_ACCOUNT_IMPLEMENTATION_GUIDE.md) | Passkey auth, SessionStore, bug history, ADRs (§1–34) |
| [**ENVIRONMENT.md**](./ENVIRONMENT.md) | Frontend + issuer environment variables |
| [**ARCHITECTURE_TRUTH.md**](./ARCHITECTURE_TRUTH.md) | Short index (supersedes outdated pre-2026-06-27 content) |

## Root-level

| Document | Description |
|----------|-------------|
| [../README.md](../README.md) | Quick start, deployment, verification |
| [../LUMENGATE_MASTER_EXECUTION_PLAN.md](../LUMENGATE_MASTER_EXECUTION_PLAN.md) | UX/design migration phases (presentation layer) |
| [../deployments.json](../deployments.json) | Testnet contract IDs |

## Reference

| Path | Description |
|------|-------------|
| [../research/stellar-docs-clone/](../research/stellar-docs-clone/) | Stellar official docs mirror (`__check_auth` tutorials, etc.) |
| [../LUMENGATE_ENGINEERING_BIBLE.md](../LUMENGATE_ENGINEERING_BIBLE.md) | Extended engineering history (may predate some fixes) |

## Historical reports

Root-level `*_REPORT.md`, `*_MASTERPLAN.md`, and similar files are **point-in-time snapshots**. When they conflict with `docs/CURRENT_ARCHITECTURE.md`, trust the docs/ folder.

## Stellar skills alignment

Implementation follows Stellar smart-account patterns:

- `__check_auth` + custom account interface — see `research/stellar-docs-clone/docs/build/guides/auth/check-auth-tutorials.mdx`
- Passkey signing via WebAuthn verifier contract
- Session-bound proof before policy enforce (Lumengate SessionStore + CompliancePolicy)
