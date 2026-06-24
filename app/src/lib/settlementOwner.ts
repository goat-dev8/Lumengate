import type { DeploymentConfig } from './config';
import { loadStoredPasskey } from './passkeys';
import { smartAccountSettlementAddress } from './smartAccount';

export function currentSettlementOwner(config: DeploymentConfig, walletAddress: string | null): string | null {
  if (!walletAddress) return null;
  return smartAccountSettlementAddress(config, loadStoredPasskey()) ?? walletAddress;
}
