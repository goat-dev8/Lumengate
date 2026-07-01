import type { DeploymentConfig, IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import {
  ASSET_SCOPES,
  proofScopeMatches,
  type SettlementAsset,
} from './assetScope';
import { isScopeNullifierSpent } from './scopeNullifier';
import { friendlyAssetName } from './productState';

export type PassportScopeUiStatus = 'none' | 'ready' | 'used' | 'renewal_required';

export type PassportScopeRow = {
  asset: SettlementAsset;
  label: string;
  status: PassportScopeUiStatus;
  badge: string;
  detail: string;
};

const SCOPE_ORDER: SettlementAsset[] = ['rwa', 'usdc', 'eurc'];

export function scopeStatusBadge(status: PassportScopeUiStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'used':
    case 'renewal_required':
      return 'Renewal required';
    default:
      return 'Not set up';
  }
}

export function scopeStatusDetail(status: PassportScopeUiStatus, label: string): string {
  switch (status) {
    case 'ready':
      return `${label} eligibility is active for your next private settlement.`;
    case 'used':
    case 'renewal_required':
      return `${label} was used in a prior settlement. Renew this scope only — other assets stay ready.`;
    default:
      return `Request your passport to unlock ${label} settlements.`;
  }
}

/** Per-asset on-chain scope status — does not imply the whole passport expired. */
export async function fetchPassportScopeRows(
  config: DeploymentConfig,
  credential: IssuerCredentialResponse | null,
  proof: ProofBundle | null,
): Promise<PassportScopeRow[]> {
  if (!credential) {
    return SCOPE_ORDER.map((asset) => ({
      asset,
      label: friendlyAssetName(asset),
      status: 'none',
      badge: scopeStatusBadge('none'),
      detail: scopeStatusDetail('none', friendlyAssetName(asset)),
    }));
  }

  const rows: PassportScopeRow[] = [];
  for (const asset of SCOPE_ORDER) {
    const scope = ASSET_SCOPES[asset];
    const label = friendlyAssetName(asset);
    let spent = false;
    try {
      spent = await isScopeNullifierSpent(config, credential, scope);
    } catch {
      spent = false;
    }

    let status: PassportScopeUiStatus;
    if (spent) {
      status = 'renewal_required';
    } else if (proof && proofScopeMatches(proof, scope)) {
      status = 'ready';
    } else if (credential) {
      status = 'ready';
    } else {
      status = 'none';
    }

    rows.push({
      asset,
      label,
      status,
      badge: scopeStatusBadge(status),
      detail: scopeStatusDetail(status, label),
    });
  }
  return rows;
}

export function assetLabelFromProofInputs(assetId: string | undefined): string {
  if (assetId === ASSET_SCOPES.usdc.assetId) return 'USDC';
  if (assetId === ASSET_SCOPES.eurc.assetId) return 'EURC';
  return 'Treasury units';
}

export function receiptDisplayAssetLabel(receipt: {
  asset?: { label?: string };
  transferResult?: { amount?: string };
}): string {
  const amount = receipt.transferResult?.amount ?? '';
  if (/USDC/i.test(amount)) return 'USDC';
  if (/EURC/i.test(amount)) return 'EURC';
  const label = receipt.asset?.label;
  if (label && label !== 'RWA') return label;
  if (/unit/i.test(amount)) return 'Treasury units';
  return label ?? 'Treasury units';
}

export function offeringSettlementAsset(
  settlementAsset: string,
): SettlementAsset {
  if (settlementAsset === 'usdc') return 'usdc';
  if (settlementAsset === 'eurc') return 'eurc';
  return 'rwa';
}
