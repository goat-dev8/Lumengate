import { poseidon2Hash } from '@zkpassport/poseidon2';
import type { IssuerCredentialResponse } from './config';

export type SettlementAsset = 'rwa' | 'usdc' | 'eurc';
export type SettlementAction = 'settlement';

export type AssetScope = {
  asset: SettlementAsset;
  action: SettlementAction;
  assetId: string;
  actionId: string;
};

export const ASSET_SCOPES: Record<SettlementAsset, AssetScope> = {
  rwa: { asset: 'rwa', action: 'settlement', assetId: '1', actionId: '1' },
  usdc: { asset: 'usdc', action: 'settlement', assetId: '2', actionId: '1' },
  eurc: { asset: 'eurc', action: 'settlement', assetId: '3', actionId: '1' },
};

function toBigInt(value: string | number | bigint | boolean | string[] | number[] | undefined): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (Array.isArray(value) || value === undefined) return 0n;
  const text = String(value).trim();
  if (!text) return 0n;
  return text.startsWith('0x') || text.startsWith('0X') ? BigInt(text) : BigInt(text);
}

export function fieldToHex(value: string | bigint): string {
  return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
}

export function scopedNullifierDecimal(
  noteSecret: string,
  policyId: string | number,
  assetId: string | number,
  actionId: string | number,
): string {
  const value = poseidon2Hash([
    toBigInt(noteSecret),
    toBigInt(policyId),
    toBigInt(assetId),
    toBigInt(actionId),
  ]);
  return value.toString(10);
}

export function scopeKey(scope: AssetScope): string {
  return `${scope.asset}:${scope.action}`;
}

export function proofScopeMatches(
  proof: { publicInputs?: { assetId?: string; actionId?: string } } | null,
  scope: AssetScope,
): boolean {
  return (
    proof?.publicInputs?.assetId === scope.assetId &&
    proof.publicInputs.actionId === scope.actionId
  );
}

export function credentialForScope(
  credential: IssuerCredentialResponse,
  scope: AssetScope,
): IssuerCredentialResponse {
  if (!credential.proverInputs?.note_secret) {
    throw new Error('Passport is missing note secret; request a new passport.');
  }
  const policyId = String(
    credential.proverInputs.policy_id ?? credential.credential.policyId ?? '1',
  );
  const nullifier = scopedNullifierDecimal(
    String(credential.proverInputs.note_secret),
    policyId,
    scope.assetId,
    scope.actionId,
  );
  return {
    ...credential,
    credential: {
      ...credential.credential,
      nullifier: fieldToHex(nullifier),
    },
    proverInputs: {
      ...credential.proverInputs,
      policy_id: policyId,
      asset_id: scope.assetId,
      action_id: scope.actionId,
      nullifier,
    },
  };
}
