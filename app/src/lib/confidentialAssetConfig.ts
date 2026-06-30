import type { DeploymentConfig } from './config';
import type { SettlementAsset } from './assetScope';

/** Supported confidential wrapper assets (SEP-41 SAC → CT wrapper). */
export type ConfidentialAssetKey = 'eurc' | 'usdc';

export type ConfidentialAssetContracts = {
  token: string;
  verifier: string;
  auditor: string;
  policy: string;
  underlying: string;
  auditorIdNum: number;
  deployedAtLedger?: number;
};

export type ConfidentialAssetConfig = {
  key: ConfidentialAssetKey;
  label: string;
  assetCode: string;
  settlementAsset: SettlementAsset;
  publicSacId: string | undefined;
  contracts: ConfidentialAssetContracts | null;
};

function readOptionalEnv(name: string): string | undefined {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const value = env?.[name];
  if (!value) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function contractsFromFields(fields: {
  token?: string;
  verifier?: string;
  auditor?: string;
  policy?: string;
  underlying?: string;
  auditorIdNum?: number;
  deployedAtLedger?: number;
}): ConfidentialAssetContracts | null {
  const { token, verifier, auditor, policy, underlying } = fields;
  if (!token || !verifier || !auditor || !policy || !underlying) return null;
  return {
    token,
    verifier,
    auditor,
    policy,
    underlying,
    auditorIdNum: fields.auditorIdNum ?? 1,
    deployedAtLedger: fields.deployedAtLedger,
  };
}

function resolveEurcAsset(config: DeploymentConfig): ConfidentialAssetConfig {
  const contracts = contractsFromFields({
    token: config.confidentialTokenId,
    verifier: config.confidentialVerifierId,
    auditor: config.confidentialAuditorId,
    policy: config.confidentialPolicyId,
    underlying: config.confidentialUnderlyingId ?? config.eurcSacId,
    auditorIdNum: config.confidentialAuditorIdNum,
    deployedAtLedger: config.confidentialDeployedAtLedger,
  });
  return {
    key: 'eurc',
    label: 'EURC',
    assetCode: 'EURC',
    settlementAsset: 'eurc',
    publicSacId: config.eurcSacId,
    contracts,
  };
}

function resolveUsdcAsset(config: DeploymentConfig): ConfidentialAssetConfig {
  const contracts = contractsFromFields({
    token: readOptionalEnv('VITE_CONFIDENTIAL_USDC_TOKEN_ID'),
    verifier: readOptionalEnv('VITE_CONFIDENTIAL_USDC_VERIFIER_ID') ?? config.confidentialVerifierId,
    auditor: readOptionalEnv('VITE_CONFIDENTIAL_USDC_AUDITOR_ID') ?? config.confidentialAuditorId,
    policy: readOptionalEnv('VITE_CONFIDENTIAL_USDC_POLICY_ID') ?? config.confidentialPolicyId,
    underlying: config.usdcSacId,
    auditorIdNum: Number(readOptionalEnv('VITE_CONFIDENTIAL_USDC_AUDITOR_ID_NUM') ?? config.confidentialAuditorIdNum ?? 1),
    deployedAtLedger: Number(readOptionalEnv('VITE_CONFIDENTIAL_USDC_DEPLOYED_AT_LEDGER') ?? 0) || undefined,
  });
  return {
    key: 'usdc',
    label: 'USDC',
    assetCode: 'USDC',
    settlementAsset: 'usdc',
    publicSacId: config.usdcSacId,
    contracts,
  };
}

const RESOLVERS: Record<ConfidentialAssetKey, (config: DeploymentConfig) => ConfidentialAssetConfig> = {
  eurc: resolveEurcAsset,
  usdc: resolveUsdcAsset,
};

export function resolveConfidentialAsset(
  config: DeploymentConfig,
  key: ConfidentialAssetKey,
): ConfidentialAssetConfig {
  return RESOLVERS[key](config);
}

export function listConfidentialAssets(config: DeploymentConfig): ConfidentialAssetConfig[] {
  return (['eurc', 'usdc'] as const).map((key) => resolveConfidentialAsset(config, key));
}

export function confidentialAssetReady(config: DeploymentConfig, key: ConfidentialAssetKey): boolean {
  return resolveConfidentialAsset(config, key).contracts !== null;
}

export function confidentialAssetForSettlement(
  config: DeploymentConfig,
  asset: SettlementAsset,
): ConfidentialAssetConfig | null {
  if (asset !== 'eurc' && asset !== 'usdc') return null;
  const row = resolveConfidentialAsset(config, asset);
  return row.contracts ? row : null;
}

export function withConfidentialContracts(
  config: DeploymentConfig,
  asset: ConfidentialAssetConfig,
): DeploymentConfig {
  if (!asset.contracts) return config;
  return {
    ...config,
    confidentialTokenId: asset.contracts.token,
    confidentialVerifierId: asset.contracts.verifier,
    confidentialAuditorId: asset.contracts.auditor,
    confidentialPolicyId: asset.contracts.policy,
    confidentialUnderlyingId: asset.contracts.underlying,
    confidentialAuditorIdNum: asset.contracts.auditorIdNum,
    confidentialDeployedAtLedger: asset.contracts.deployedAtLedger,
  };
}
