import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import { ASSET_SCOPES, scopedNullifierDecimal, type AssetScope } from './assetScope';

function scopeForProof(proof: ProofBundle): AssetScope | null {
  return (
    Object.values(ASSET_SCOPES).find(
      (scope) =>
        scope.assetId === proof.publicInputs.assetId &&
        scope.actionId === proof.publicInputs.actionId,
    ) ?? null
  );
}

/** Nullifier the proof must carry for this credential + asset/action scope. */
export function expectedNullifierForCredential(
  credential: IssuerCredentialResponse,
  proof: ProofBundle,
): string | null {
  if (!credential.proverInputs) return null;
  const noteSecret = credential.proverInputs.note_secret;
  const policyId = String(
    credential.proverInputs.policy_id ?? credential.credential.policyId ?? '1',
  );
  if (noteSecret) {
    const scope = scopeForProof(proof);
    if (scope) {
      return scopedNullifierDecimal(String(noteSecret), policyId, scope.assetId, scope.actionId);
    }
  }
  if (credential.proverInputs.nullifier == null) return null;
  return String(credential.proverInputs.nullifier);
}

/** Proof is valid only for the credential that produced its scoped nullifier. */
export function proofMatchesCredential(
  proof: ProofBundle | null,
  credential: IssuerCredentialResponse | null,
): boolean {
  if (!proof || !credential) return false;
  const expected = expectedNullifierForCredential(credential, proof);
  if (expected == null) return false;
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
