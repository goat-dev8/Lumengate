import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import { proofMatchesCredential } from './credentialProof';
import type { ProofLifecycleState } from './proofLifecycle';

/** Single product lifecycle — maps to on-chain proof/nullifier state. */
export type PassportPhase =
  | 'none'
  | 'passport-issued'
  | 'proof-generated'
  | 'proof-spent'
  | 'expired';

export function derivePassportPhase(input: {
  address: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  lifecycle: ProofLifecycleState;
}): PassportPhase {
  if (!input.address) return 'none';
  if (input.lifecycle.lifecycle === 'consumed') return 'proof-spent';
  if (input.lifecycle.lifecycle === 'invalid') return 'expired';
  if (input.proof && input.credential && proofMatchesCredential(input.proof, input.credential)) {
    if (input.lifecycle.lifecycle === 'ready') return 'proof-generated';
  }
  if (input.credential) return 'passport-issued';
  return 'none';
}

export function canSettle(phase: PassportPhase): boolean {
  return phase === 'proof-generated';
}

export function phaseLabel(phase: PassportPhase): string {
  switch (phase) {
    case 'none':
      return 'Get started';
    case 'passport-issued':
      return 'Confirm eligibility';
    case 'proof-generated':
      return 'Ready to invest or send';
    case 'proof-spent':
      return 'Renew passport';
    case 'expired':
      return 'Renew passport';
    default:
      return 'Get started';
  }
}
