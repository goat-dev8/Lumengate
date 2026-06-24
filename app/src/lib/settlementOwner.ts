import type { DeploymentConfig } from './config';
import { parseStellarAmount } from './assetAmount';
import { readBalance, readComplianceAdminUsdcBalance, readEurcSacBalance } from './contracts';
import { loadStoredPasskey, type StoredPasskey } from './passkeys';
import { smartAccountSettlementAddress } from './smartAccount';

export type SettlementSigner = {
  from: string;
  passkey: StoredPasskey | null;
  useSmartAccountAuth: boolean;
};

export function currentSettlementOwner(config: DeploymentConfig, walletAddress: string | null): string | null {
  if (!walletAddress) return null;
  return smartAccountSettlementAddress(config, loadStoredPasskey()) ?? walletAddress;
}

/** Use smart account only when passkey is registered AND it holds the settlement asset. */
export async function resolveSettlementSigner(
  config: DeploymentConfig,
  walletAddress: string,
  asset: 'rwa' | 'usdc' | 'eurc',
): Promise<SettlementSigner> {
  const passkey = loadStoredPasskey();
  const smartId = smartAccountSettlementAddress(config, passkey);
  if (!passkey || !smartId) {
    return { from: walletAddress, passkey: null, useSmartAccountAuth: false };
  }
  try {
    let funded = false;
    if (asset === 'rwa') {
      funded = BigInt(await readBalance(config, smartId)) > 0n;
    } else if (asset === 'usdc') {
      const snap = await readComplianceAdminUsdcBalance(config, smartId);
      funded = snap.raw > 0n;
    } else if (config.eurcSacId) {
      funded = parseStellarAmount(await readEurcSacBalance(config, smartId)) > 0n;
    }
    if (funded) {
      return { from: smartId, passkey, useSmartAccountAuth: true };
    }
  } catch {
    /* fall back to wallet settlement */
  }
  return { from: walletAddress, passkey: null, useSmartAccountAuth: false };
}
