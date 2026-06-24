import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';

/** Proof is valid only for the credential that produced its nullifier. */
export function proofMatchesCredential(
  proof: ProofBundle | null,
  credential: IssuerCredentialResponse | null,
): boolean {
  if (!proof || !credential?.proverInputs?.nullifier) return false;
  const expected = String(credential.proverInputs.nullifier);
  return proof.publicInputs.nullifier === expected;
}

export function credentialNullifierPreview(credential: IssuerCredentialResponse): string {
  return credential.credential.nullifier;
}

/** Hex nullifier for on-chain PolicyVerifier spent checks. */
export function nullifierHexFromCredential(credential: IssuerCredentialResponse): string {
  const raw = credential.proverInputs?.nullifier ?? credential.credential.nullifier;
  const text = String(raw);
  if (text.startsWith('0x')) return text;
  return `0x${BigInt(text).toString(16).padStart(64, '0')}`;
}
