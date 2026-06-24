import type { ProofLifecycleState } from './proofLifecycle';

export type RecoveryStep = 'credential' | 'proof' | 'passport';

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
      ? `Settlement ${consumedTxHash.slice(0, 12)}… consumed your nullifier. Request a new passport, then generate a new proof.`
      : 'Your proof was consumed. Request a new passport, then generate a new proof.',
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

export function verifyStepFlags(input: {
  address: boolean;
  passkey: boolean;
  credential: boolean;
  activeProof: boolean;
  passportActivated: boolean;
  lifecycle: ProofLifecycleState['lifecycle'];
}) {
  const consumed = input.lifecycle === 'consumed';
  return {
    wallet: input.address,
    passkey: input.passkey,
    credential: input.credential && !consumed,
    proof: input.activeProof,
    passport: input.passportActivated && input.activeProof,
  };
}
