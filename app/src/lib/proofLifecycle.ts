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

export function deriveProofLifecycle(
  credential: IssuerCredentialResponse | null,
  proof: ProofBundle | null,
  consumedTxHash: string | null = null,
): ProofLifecycleState {
  if (!credential) {
    return { lifecycle: 'none', consumedTxHash: null, reason: null };
  }
  if (!proof) {
    if (consumedTxHash) {
      return {
        lifecycle: 'consumed',
        consumedTxHash,
        reason: 'Proof consumed by a previous settlement.',
      };
    }
    return { lifecycle: 'none', consumedTxHash: null, reason: null };
  }
  if (!proofMatchesCredential(proof, credential)) {
    return {
      lifecycle: 'invalid',
      consumedTxHash: null,
      reason: 'Proof does not match current passport — regenerate proof.',
    };
  }
  if (consumedTxHash) {
    return {
      lifecycle: 'consumed',
      consumedTxHash,
      reason: 'Proof consumed by a previous settlement.',
    };
  }
  return { lifecycle: 'ready', consumedTxHash: null, reason: null };
}

/** Sync lifecycle with on-chain nullifier spent set (source of truth). */
export async function syncProofLifecycleOnChain(
  config: DeploymentConfig,
  credential: IssuerCredentialResponse | null,
  proof: ProofBundle | null,
  consumedTxHash: string | null,
): Promise<ProofLifecycleState> {
  const base = deriveProofLifecycle(credential, proof, consumedTxHash);
  if (base.lifecycle !== 'ready' || !proof) return base;

  try {
    const spent = await readNullifierSpent(
      config,
      nullifierHexFromBundle(proof),
      Number(proof.publicInputs.policyId),
    );
    if (spent) {
      return {
        lifecycle: 'consumed',
        consumedTxHash,
        reason: 'Proof consumed by a previous settlement.',
      };
    }
  } catch {
    /* keep ready — RPC may be temporarily unavailable */
  }
  return base;
}

export function isProofUsable(state: ProofLifecycleState): boolean {
  return state.lifecycle === 'ready';
}
