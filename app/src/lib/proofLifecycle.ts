import type { DeploymentConfig } from './config';
import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import { nullifierHexFromBundle, readNullifierSpent } from './contracts';
import { proofMatchesCredential } from './credentialProof';

export type ProofLifecycle = 'none' | 'ready' | 'consumed' | 'invalid';

export type ProofLifecycleState = {
  lifecycle: ProofLifecycle;
  consumedTxHash: string | null;
  reason: string | null;
};

/** Offline snapshot — use syncProofLifecycleOnChain for authoritative state. */
export function deriveProofLifecycle(
  credential: IssuerCredentialResponse | null,
  proof: ProofBundle | null,
  settlementTxHash: string | null = null,
): ProofLifecycleState {
  void settlementTxHash;
  if (!credential) {
    return { lifecycle: 'none', consumedTxHash: null, reason: null };
  }
  if (!proof) {
    return { lifecycle: 'none', consumedTxHash: null, reason: null };
  }
  if (!proofMatchesCredential(proof, credential)) {
    return {
      lifecycle: 'invalid',
      consumedTxHash: null,
      reason: 'Eligibility confirmation does not match current passport — confirm again.',
    };
  }
  return { lifecycle: 'ready', consumedTxHash: null, reason: null };
}

/**
 * Source of truth: PolicyVerifier.is_nullifier_spent for THIS credential's nullifier.
 * Do NOT infer consumed from historical settlement tx alone — that blocked fresh passports.
 */
export async function syncProofLifecycleOnChain(
  config: DeploymentConfig,
  credential: IssuerCredentialResponse | null,
  proof: ProofBundle | null,
  settlementTxHash: string | null,
): Promise<ProofLifecycleState> {
  if (!credential) {
    return { lifecycle: 'none', consumedTxHash: null, reason: null };
  }

  if (!proof) {
    return {
      lifecycle: 'none',
      consumedTxHash: settlementTxHash,
      reason: settlementTxHash
        ? 'Settlement completed. Generate a new asset-scoped proof for the next action.'
        : null,
    };
  }

  const policyId = Number(proof.publicInputs.policyId || credential.credential.policyId || 1);
  let nullifierSpent = false;
  try {
    nullifierSpent = await readNullifierSpent(
      config,
      nullifierHexFromBundle(proof),
      policyId,
      {
        assetId: proof.publicInputs.assetId,
        actionId: proof.publicInputs.actionId,
      },
    );
  } catch {
    /* If RPC fails and we have a matching ready proof, keep ready */
    if (proof && proofMatchesCredential(proof, credential)) {
      return { lifecycle: 'ready', consumedTxHash: null, reason: null };
    }
  }

  if (proof && proofMatchesCredential(proof, credential)) {
    if (nullifierSpent) {
      return {
        lifecycle: 'consumed',
        consumedTxHash: settlementTxHash,
        reason:
          'This asset/action eligibility was already used on-chain. Renew your passport on Verify, then confirm and authorize again.',
      };
    }
    return { lifecycle: 'ready', consumedTxHash: null, reason: null };
  }

  if (!proofMatchesCredential(proof, credential)) {
    return {
      lifecycle: 'invalid',
      consumedTxHash: null,
      reason: 'Eligibility confirmation does not match current passport — confirm again.',
    };
  }

  return { lifecycle: 'none', consumedTxHash: null, reason: null };
}

export function isProofUsable(state: ProofLifecycleState): boolean {
  return state.lifecycle === 'ready';
}
