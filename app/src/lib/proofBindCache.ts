import type { ProofBundle } from './contracts';

function digest(proof: ProofBundle): string {
  const hex = (proof.proofHex ?? '').replace(/^0x/i, '').toLowerCase();
  const pi = (proof.publicInputsHex ?? '').replace(/^0x/i, '').toLowerCase();
  return `${hex}:${pi}`;
}

let lastBoundDigest: string | null = null;

export function markProofBoundLocally(proof: ProofBundle): void {
  lastBoundDigest = digest(proof);
}

export function isProofBoundLocally(proof: ProofBundle): boolean {
  return lastBoundDigest === digest(proof);
}

export function clearLocalProofBindCache(): void {
  lastBoundDigest = null;
}
