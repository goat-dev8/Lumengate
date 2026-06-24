import type { IssuerCredentialResponse } from './config';
import { extractPublicInputFields, type ProofBundle } from './contracts';
import type { ProofReceipt } from './proofReceipt';
import type { PolicyKey } from './policies';
import { policyByKey } from './policies';
import { issuerStellarAddress } from './issuer';
import { credentialExpiryMs } from './passport';

export type DisclosurePack = {
  version: 1;
  createdAt: number;
  walletAddress: string;
  walletField: string;
  policyKey: PolicyKey;
  policyId: number;
  claims: string[];
  issuerEthAddress: string;
  issuerId: number;
  issuedAt: number;
  expiresAt: number;
  credentialCommitment: string;
  nullifier: string;
  merkleRoot: string;
  revocationRoot: string;
  proofPublicInputs: ProofBundle['publicInputs'];
  proofPublicInputsHex: string;
  txHash?: string;
};

export function buildDisclosurePack(input: {
  walletAddress: string;
  walletField: string;
  policyKey: PolicyKey;
  credential: IssuerCredentialResponse;
  proof: ProofBundle;
  txHash?: string;
}): DisclosurePack {
  const policy = policyByKey(input.policyKey);
  return {
    version: 1,
    createdAt: Date.now(),
    walletAddress: input.walletAddress,
    walletField: input.walletField,
    policyKey: input.policyKey,
    policyId: policy.policyId,
    claims: policy.claims,
    issuerEthAddress: issuerStellarAddress(input.credential) ?? '',
    issuerId: input.credential.issuerId,
    issuedAt: input.credential.issuedAt ?? Date.now(),
    expiresAt: credentialExpiryMs(input.credential),
    credentialCommitment: input.credential.credential.commitment,
    nullifier: input.proof.publicInputs.nullifier,
    merkleRoot: input.proof.publicInputs.root,
    revocationRoot: input.proof.publicInputs.revocationRoot,
    proofPublicInputs: input.proof.publicInputs,
    proofPublicInputsHex: input.proof.publicInputsHex,
    txHash: input.txHash,
  };
}

export function buildDisclosurePackFromReceipt(input: {
  credential: IssuerCredentialResponse;
  receipt: ProofReceipt;
  txHash?: string;
}): DisclosurePack {
  const publicInputs = extractPublicInputFields(input.receipt.proofPublicInputsHex);
  return {
    version: 1,
    createdAt: Date.now(),
    walletAddress: input.receipt.walletAddress,
    walletField: input.receipt.walletField,
    policyKey: input.receipt.policyKey,
    policyId: input.receipt.policyId,
    claims: input.receipt.claims,
    issuerEthAddress: issuerStellarAddress(input.credential) ?? '',
    issuerId: input.credential.issuerId,
    issuedAt: input.credential.issuedAt ?? Date.now(),
    expiresAt: credentialExpiryMs(input.credential),
    credentialCommitment: input.credential.credential.commitment,
    nullifier: publicInputs.nullifier,
    merkleRoot: publicInputs.root,
    revocationRoot: publicInputs.revocationRoot,
    proofPublicInputs: publicInputs,
    proofPublicInputsHex: input.receipt.proofPublicInputsHex,
    txHash: input.txHash ?? input.receipt.transactions.transfer,
  };
}

export function parseDisclosurePack(raw: string): DisclosurePack {
  const parsed = JSON.parse(raw) as DisclosurePack;
  if (parsed.version !== 1) {
    throw new Error('Unsupported disclosure pack version');
  }
  if (!parsed.walletAddress || !parsed.proofPublicInputsHex) {
    throw new Error('Invalid disclosure pack');
  }
  return parsed;
}

export function disclosurePackFilename(walletAddress: string): string {
  return `lumengate-disclosure-${walletAddress.slice(0, 8)}.json`;
}
