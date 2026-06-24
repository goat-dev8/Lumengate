import type { DeploymentConfig } from './config';

export function currentSettlementOwner(config: DeploymentConfig, walletAddress: string | null): string | null {
  void config;
  if (!walletAddress) return null;
  return walletAddress;
}
