import type { PolicyKey } from './policies';

export type LiveOffering = {
  id: string;
  title: string;
  category: 'treasury' | 'real-estate' | 'private-credit';
  description: string;
  requiredPolicy: PolicyKey;
  minimumAmount: string;
  unitLabel: string;
  policyId: number;
  claims: string[];
  eligibilityPolicy: string;
  settlementPolicy: string;
  verificationRoute: string;
  proofRequirements: string[];
  settlementAddress: string | null;
  contracts: {
    rwaTokenId: string | null;
    policyVerifierId: string | null;
    rwaAdapterId: string | null;
    compliantDexId?: string | null;
    compliantPayrollId?: string | null;
  };
  complianceTargets: {
    usdcSacId: string;
    usdcIssuer: string;
  };
  fundsThreshold?: string;
  whyProofRequired: string;
  settlementAsset: 'rwa' | 'usdc' | 'eurc';
  settlementRoute?: 'rwa' | 'sac' | 'dex' | 'payroll';
  riskLevel: string;
  offeringStatus: string;
};

export async function fetchOfferings(issuerServiceUrl: string): Promise<LiveOffering[]> {
  const res = await fetch(`${issuerServiceUrl.replace(/\/$/, '')}/offerings`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/offerings failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { offerings: LiveOffering[] };
  return json.offerings;
}

export function offeringMinimumBigInt(offering: LiveOffering): bigint {
  return BigInt(offering.minimumAmount);
}
