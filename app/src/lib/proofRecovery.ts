import type { ProofLifecycleState } from './proofLifecycle';

export type RecoveryStep = 'credential' | 'proof' | 'ready';

export type RecoveryPlan = {
  step: RecoveryStep;
  message: string;
  requiresNewCredential: true;
  requiresNewProof: true;
};

/** After on-chain NullifierSpent, issuer must issue fresh note_secret → fresh nullifier. */
export function recoveryPlanAfterNullifierSpent(consumedTxHash: string | null): RecoveryPlan {
  return {
    step: 'credential',
    requiresNewCredential: true,
    requiresNewProof: true,
    message: consumedTxHash
      ? `Settlement ${consumedTxHash.slice(0, 12)}… used this passport slot. Request a new passport below, then confirm eligibility and authorize with passkey.`
      : 'This passport slot was already used on-chain. Request a new passport below, then confirm eligibility and authorize with passkey.',
  };
}

export function recoveryLog(event: string, detail?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.info(`[Lumengate:recovery] ${event}`, detail ?? '');
  }
}

export function isStaleCredentialState(
  lifecycle: ProofLifecycleState,
  hasCredential: boolean,
): boolean {
  return lifecycle.lifecycle === 'consumed' && hasCredential;
}

export type VerifyStepId = 'wallet' | 'credential' | 'proof' | 'ready';

/** Four-step consumer verify flow. */
export function verifyStepFlags(input: {
  address: boolean;
  credential: boolean;
  activeProof: boolean;
  lifecycle: ProofLifecycleState['lifecycle'];
}): Record<VerifyStepId, boolean> {
  const consumed = input.lifecycle === 'consumed';
  return {
    wallet: input.address,
    credential: input.credential && !consumed,
    proof: input.activeProof,
    ready: input.activeProof,
  };
}
