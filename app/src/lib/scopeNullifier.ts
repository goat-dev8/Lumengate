import type { DeploymentConfig, IssuerCredentialResponse } from './config';
import {
  ASSET_SCOPES,
  credentialForScope,
  fieldToHex,
  type AssetScope,
  type SettlementAsset,
} from './assetScope';
import { readNullifierSpent } from './contracts';
import { friendlyAssetName } from './productState';

export function scopeNullifierHex(
  credential: IssuerCredentialResponse,
  scope: AssetScope,
): string {
  const scoped = credentialForScope(credential, scope);
  const nullifier =
    scoped.proverInputs?.nullifier ?? scoped.credential.nullifier;
  if (!nullifier) {
    throw new Error('Passport is missing nullifier; request a new passport.');
  }
  return fieldToHex(String(nullifier));
}

/** On-chain replay guard for a credential + asset/action scope (no proof required). */
export async function isScopeNullifierSpent(
  config: DeploymentConfig,
  credential: IssuerCredentialResponse,
  scope: AssetScope,
): Promise<boolean> {
  const scoped = credentialForScope(credential, scope);
  const policyId = Number(
    scoped.proverInputs?.policy_id ?? scoped.credential.policyId ?? config.policyId,
  );
  return readNullifierSpent(config, scopeNullifierHex(credential, scope), policyId, {
    assetId: scope.assetId,
    actionId: scope.actionId,
  });
}

export function scopeNullifierSpentMessage(asset: SettlementAsset): string {
  return (
    `Your ${friendlyAssetName(asset)} eligibility was already used on-chain. ` +
    'Renew your passport on Verify (Request passport), confirm eligibility, authorize with passkey, then send again.'
  );
}

export async function assertScopeNullifierAvailable(
  config: DeploymentConfig,
  credential: IssuerCredentialResponse,
  asset: SettlementAsset,
): Promise<void> {
  const scope = ASSET_SCOPES[asset];
  if (await isScopeNullifierSpent(config, credential, scope)) {
    throw new Error(scopeNullifierSpentMessage(asset));
  }
}
