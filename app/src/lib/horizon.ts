import type { DeploymentConfig } from './config';
import { loadComplianceAssetTargets } from './assets';
import { readUsdcSacBalance } from './contracts';
import { parseStellarAmount } from './assetAmount';
export type UsdcBalanceSnapshot = {
  assetCode: string;
  issuer: string;
  sacId: string;
  classicBalance: string | null;
  sacBalance: string | null;
  trustlineExists: boolean;
  complianceAdminConfigured: boolean;
  note: string;
};

/** Read classic USDC trustline balance via Horizon; settlement checks use Soroban balances. */
export async function fetchUsdcBalanceSnapshot(
  config: DeploymentConfig,
  accountId: string | null,
): Promise<UsdcBalanceSnapshot> {
  const targets = loadComplianceAssetTargets();
  const base: UsdcBalanceSnapshot = {
    assetCode: targets.usdcCode,
    issuer: targets.usdcIssuer,
    sacId: targets.usdcSac,
    classicBalance: null,
    sacBalance: null,
    trustlineExists: false,
    complianceAdminConfigured: Boolean(config.complianceSacAdminId),
    note: config.complianceSacAdminId
      ? 'USDC SAC balance via RPC. Proof-gated settlement via ComplianceSacAdmin.transfer_compliant.'
      : 'USDC SAC readable via RPC. Deploy compliance_sac_admin and set VITE_COMPLIANCE_SAC_ADMIN_ID for gated USDC transfers.',
  };

  if (!accountId) return base;

  try {
    base.sacBalance = await readUsdcSacBalance(config, accountId);
  } catch {
    base.sacBalance = null;
  }

  try {
    const url = `${config.horizonUrl.replace(/\/$/, '')}/accounts/${accountId}`;
    const res = await fetch(url);
    if (!res.ok) return base;
    const json = (await res.json()) as {
      balances?: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string; balance: string }>;
    };
    const usdc = json.balances?.find(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code === targets.usdcCode &&
        b.asset_issuer === targets.usdcIssuer,
    );
    if (usdc) {
      base.trustlineExists = true;
      base.classicBalance = usdc.balance;
    }
  } catch {
    /* Horizon optional */
  }

  return base;
}

export type UsdcTrustlineStatus = 'ready' | 'missing' | 'unknown';
export type UsdcCapacityStatus = UsdcTrustlineStatus | 'insufficient_limit';

/** Definitive USDC trustline check via Horizon (unknown when Horizon is unreachable). */
export async function checkRecipientUsdcTrustline(
  config: DeploymentConfig,
  accountId: string,
): Promise<UsdcTrustlineStatus> {
  const targets = loadComplianceAssetTargets();
  try {
    const url = `${config.horizonUrl.replace(/\/$/, '')}/accounts/${accountId}`;
    const res = await fetch(url);
    if (res.status === 404) return 'missing';
    if (!res.ok) return 'unknown';
    const json = (await res.json()) as {
      balances?: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
    };
    const usdc = json.balances?.find(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code === targets.usdcCode &&
        b.asset_issuer === targets.usdcIssuer,
    );
    return usdc ? 'ready' : 'missing';
  } catch {
    return 'unknown';
  }
}

/** Horizon trustline capacity check for classic G-address recipients. */
export async function checkRecipientUsdcCapacity(
  config: DeploymentConfig,
  accountId: string,
  amount: string,
): Promise<UsdcCapacityStatus> {
  const targets = loadComplianceAssetTargets();
  try {
    const url = `${config.horizonUrl.replace(/\/$/, '')}/accounts/${accountId}`;
    const res = await fetch(url);
    if (res.status === 404) return 'missing';
    if (!res.ok) return 'unknown';
    const json = (await res.json()) as {
      balances?: Array<{
        asset_type: string;
        asset_code?: string;
        asset_issuer?: string;
        balance?: string;
        limit?: string;
      }>;
    };
    const usdc = json.balances?.find(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code === targets.usdcCode &&
        b.asset_issuer === targets.usdcIssuer,
    );
    if (!usdc) return 'missing';
    if (!usdc.limit || !usdc.balance) return 'ready';
    const balanceRaw = parseStellarAmount(usdc.balance);
    const limitRaw = parseStellarAmount(usdc.limit);
    const amountRaw = parseStellarAmount(amount);
    return balanceRaw + amountRaw <= limitRaw ? 'ready' : 'insufficient_limit';
  } catch {
    return 'unknown';
  }
}
