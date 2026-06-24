import type { DeploymentConfig } from './config';

export function currentSettlementOwner(
  config: DeploymentConfig,
  walletAddress: string | null,
  smartAccountAddress?: string | null,
): string | null {
  void config;
  if (smartAccountAddress) return smartAccountAddress;
  if (!walletAddress) return null;
  return walletAddress;
}
