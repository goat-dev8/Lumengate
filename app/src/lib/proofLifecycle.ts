import type { DeploymentConfig } from './config';
import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import { readNullifierSpent } from './contracts';
import { nullifierHexFromCredential, proofMatchesCredential } from './credentialProof';

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
      reason: 'Proof does not match current passport — regenerate proof.',
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

  const policyId = Number(
    credential.proverInputs?.policy_id ?? credential.credential.policyId ?? 1,
  );
  let nullifierSpent = false;
  try {
    nullifierSpent = await readNullifierSpent(
      config,
      nullifierHexFromCredential(credential),
      policyId,
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
        reason: 'Proof consumed by a previous settlement.',
      };
    }
    return { lifecycle: 'ready', consumedTxHash: null, reason: null };
  }

  if (proof && !proofMatchesCredential(proof, credential)) {
    return {
      lifecycle: 'invalid',
      consumedTxHash: null,
      reason: 'Proof does not match current passport — regenerate proof.',
    };
  }

  if (nullifierSpent) {
    return {
      lifecycle: 'consumed',
      consumedTxHash: settlementTxHash,
      reason: 'This passport nullifier was already spent. Request a new passport.',
    };
  }

  return { lifecycle: 'none', consumedTxHash: null, reason: null };
}

export function isProofUsable(state: ProofLifecycleState): boolean {
  return state.lifecycle === 'ready';
}
