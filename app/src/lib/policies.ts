export type PolicyKey =
  | 'general-eligibility'
  | 'accredited-investor'
  | 'us-jurisdiction'
  | 'sanctions-clear'
  | 'age-verified'
  | 'proof-of-funds';

export type PolicyDefinition = {
  key: PolicyKey;
  policyId: number;
  title: string;
  description: string;
  /** Human-readable claims proven without revealing raw PII */
  claims: string[];
  minJurisdiction?: number;
  maxJurisdiction?: number;
  fundsThreshold?: bigint;
};

export const POLICIES: Record<PolicyKey, PolicyDefinition> = {
  'general-eligibility': {
    key: 'general-eligibility',
    policyId: 1,
    title: 'General RWA eligibility',
    description: 'Accredited, sanctions-clear, jurisdiction allowed, 18+',
    claims: ['Accredited investor', 'Sanctions clear', 'Jurisdiction allowed', 'Age 18+'],
    minJurisdiction: 1,
    maxJurisdiction: 999,
  },
  'accredited-investor': {
    key: 'accredited-investor',
    policyId: 1,
    title: 'Accredited investor',
    description: 'Proves accredited status without revealing identity',
    claims: ['Accredited investor'],
    minJurisdiction: 1,
    maxJurisdiction: 999,
  },
  'us-jurisdiction': {
    key: 'us-jurisdiction',
    policyId: 1,
    title: 'US jurisdiction',
    description: 'Proves jurisdiction code is US (840) without revealing other attributes',
    claims: ['US jurisdiction allowed'],
    minJurisdiction: 840,
    maxJurisdiction: 840,
  },
  'sanctions-clear': {
    key: 'sanctions-clear',
    policyId: 1,
    title: 'Sanctions clear',
    description: 'Proves sanctions screening passed',
    claims: ['Sanctions clear'],
    minJurisdiction: 1,
    maxJurisdiction: 999,
  },
  'age-verified': {
    key: 'age-verified',
    policyId: 1,
    title: 'Age verified (18+)',
    description: 'Proves age threshold without revealing date of birth',
    claims: ['Age 18 or older'],
    minJurisdiction: 1,
    maxJurisdiction: 999,
  },
  'proof-of-funds': {
    key: 'proof-of-funds',
    policyId: 2,
    title: 'Proof of funds',
    description: 'Proves RWA balance meets threshold without revealing exact balance',
    claims: ['Balance meets minimum threshold'],
    fundsThreshold: 50n,
  },
};

export function policyByKey(key: PolicyKey): PolicyDefinition {
  return POLICIES[key];
}

export function policyList(): PolicyDefinition[] {
  return Object.values(POLICIES);
}
