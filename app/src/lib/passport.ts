import type { DeploymentConfig, IssuerCredentialResponse, OnChainRoots } from './config';
import { readOnChainRoots } from './contracts';
import type { ProofBundle } from './contracts';
import { proofMatchesCredential } from './credentialProof';
import type { PolicyKey } from './policies';
import { policyByKey } from './policies';
import { issuerStellarAddress } from './issuer';

export type PassportStatus =
  | 'no-wallet'
  | 'no-credential'
  | 'roots-mismatch'
  | 'expired'
  | 'valid'
  | 'proof-ready'
  | 'proof-spent';

export type PassportSnapshot = {
  status: PassportStatus;
  walletAddress: string | null;
  walletField: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  policyKey: PolicyKey | null;
  onChainRoots: OnChainRoots | null;
  rootsMatch: boolean;
  issuedAt: number | null;
  expiresAt: number | null;
  issuerEthAddress: string | null;
  issuerId: number | null;
  nullifierPreview: string | null;
  claims: string[];
  errors: string[];
};

const DEFAULT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function credentialExpiryMs(credential: IssuerCredentialResponse): number {
  const issued = credential.issuedAt ?? Date.now();
  return issued + DEFAULT_TTL_MS;
}

export function isCredentialExpired(credential: IssuerCredentialResponse, now = Date.now()): boolean {
  return now > credentialExpiryMs(credential);
}

export function rootsMatchCredential(
  onChain: OnChainRoots,
  credential: IssuerCredentialResponse,
): boolean {
  const norm = (v: string) => v.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  return (
    norm(onChain.root) === norm(credential.credential.root) &&
    norm(onChain.revocationRoot) === norm(credential.credential.revocationRoot)
  );
}

export async function buildPassportSnapshot(input: {
  config: DeploymentConfig;
  address: string | null;
  walletField: string | null;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  policyKey: PolicyKey | null;
  nullifierSpent?: boolean;
}): Promise<PassportSnapshot> {
  const errors: string[] = [];
  if (!input.address || !input.walletField) {
    return {
      status: 'no-wallet',
      walletAddress: input.address,
      walletField: input.walletField,
      credential: null,
      proof: null,
      policyKey: input.policyKey,
      onChainRoots: null,
      rootsMatch: false,
      issuedAt: null,
      expiresAt: null,
      issuerEthAddress: null,
      issuerId: null,
      nullifierPreview: null,
      claims: [],
      errors,
    };
  }

  if (!input.credential) {
    return {
      status: 'no-credential',
      walletAddress: input.address,
      walletField: input.walletField,
      credential: null,
      proof: null,
      policyKey: input.policyKey,
      onChainRoots: null,
      rootsMatch: false,
      issuedAt: null,
      expiresAt: null,
      issuerEthAddress: null,
      issuerId: null,
      nullifierPreview: null,
      claims: [],
      errors,
    };
  }

  let onChainRoots: OnChainRoots | null = null;
  try {
    onChainRoots = await readOnChainRoots(input.config);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const rootsOk = onChainRoots ? rootsMatchCredential(onChainRoots, input.credential) : false;
  if (onChainRoots && !rootsOk) {
    errors.push('Credential roots do not match on-chain CredentialRegistry');
  }

  const expired = isCredentialExpired(input.credential);
  if (expired) {
    errors.push('Credential has expired — request a new credential');
  }

  const policy = input.policyKey ? policyByKey(input.policyKey) : null;
  const claims = policy?.claims ?? [];

  let status: PassportStatus = 'valid';
  if (!rootsOk) status = 'roots-mismatch';
  else if (expired) status = 'expired';
  else if (input.proof && proofMatchesCredential(input.proof, input.credential)) {
    status = input.nullifierSpent ? 'proof-spent' : 'proof-ready';
  }

  return {
    status,
    walletAddress: input.address,
    walletField: input.walletField,
    credential: input.credential,
    proof: input.proof,
    policyKey: input.policyKey,
    onChainRoots,
    rootsMatch: rootsOk,
    issuedAt: input.credential.issuedAt ?? null,
    expiresAt: credentialExpiryMs(input.credential),
    issuerEthAddress: issuerStellarAddress(input.credential),
    issuerId: input.credential.issuerId,
    nullifierPreview: input.credential.credential.nullifier,
    claims,
    errors,
  };
}
