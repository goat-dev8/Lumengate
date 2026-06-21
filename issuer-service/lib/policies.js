const POLICIES = {
  'general-eligibility': {
    key: 'general-eligibility',
    policyId: 1,
    title: 'General RWA eligibility',
    minJurisdiction: 1,
    maxJurisdiction: 999,
    claims: ['Accredited investor', 'Sanctions clear', 'Jurisdiction allowed', 'Age 18+'],
  },
  'accredited-investor': {
    key: 'accredited-investor',
    policyId: 1,
    title: 'Accredited investor',
    minJurisdiction: 1,
    maxJurisdiction: 999,
    claims: ['Accredited investor'],
  },
  'us-jurisdiction': {
    key: 'us-jurisdiction',
    policyId: 1,
    title: 'US jurisdiction',
    minJurisdiction: 840,
    maxJurisdiction: 840,
    claims: ['US jurisdiction allowed'],
  },
  'sanctions-clear': {
    key: 'sanctions-clear',
    policyId: 1,
    title: 'Sanctions clear',
    minJurisdiction: 1,
    maxJurisdiction: 999,
    claims: ['Sanctions clear'],
  },
  'age-verified': {
    key: 'age-verified',
    policyId: 1,
    title: 'Age verified (18+)',
    minJurisdiction: 1,
    maxJurisdiction: 999,
    claims: ['Age 18 or older'],
  },
  'proof-of-funds': {
    key: 'proof-of-funds',
    policyId: 2,
    title: 'Proof of funds',
    fundsThreshold: 50,
    claims: ['Balance meets minimum threshold'],
  },
};

function policyByKey(key) {
  return POLICIES[key] || POLICIES['general-eligibility'];
}

function policyList() {
  return Object.values(POLICIES);
}

module.exports = { POLICIES, policyByKey, policyList };
