const { createHash } = require('crypto');
const {
  fieldToBytes32Hex,
  hash2Fields,
  hash3Fields,
  toBigInt,
} = require('./poseidonFields');
const { policyByKey } = require('./policies');
const { syncCredentialRootOnChain: syncCredentialRootViaSdk, normalizeHex32 } = require('./sorobanAdmin');

function fieldFromHash(parts) {
  const h = createHash('sha256')
    .update(parts.map((p) => String(p)).join(':'))
    .digest('hex')
    .slice(0, 62);
  return BigInt(`0x${h}`).toString();
}

function singleLeafRoot(commitment) {
  let cur = toBigInt(commitment);
  for (let i = 0; i < 8; i++) {
    cur = hash2Fields(cur, 0);
  }
  return fieldToBytes32Hex(cur);
}

function buildCredentialMaterial(walletField, env = process.env, policyKey = 'general-eligibility') {
  const policy = policyByKey(policyKey);
  const issuerId = String(env.ISSUER_ID || env.ISSUER_ETH_ID || 2);
  const accredited = true;
  const sanctionsClear = true;
  const jurisdictionCode = '840';
  const dobTimestamp = '631152000';
  // One commitment per wallet — policy affects prover inputs (min/max jurisdiction), not the Merkle leaf.
  const salt = fieldFromHash(['lumengate-credential-v1', walletField, issuerId]);

  const attrsHash = hash3Fields(
    hash2Fields(accredited ? 1 : 0, jurisdictionCode),
    hash2Fields(dobTimestamp, sanctionsClear ? 1 : 0),
    issuerId,
  );
  const commitment = fieldToBytes32Hex(hash2Fields(attrsHash, salt));
  const root = singleLeafRoot(commitment);

  return {
    commitment,
    root,
    issuerId,
    salt,
    accredited,
    sanctionsClear,
    jurisdictionCode,
    dobTimestamp,
    minJurisdiction: String(policy.minJurisdiction ?? 1),
    maxJurisdiction: String(policy.maxJurisdiction ?? 999),
    policyId: String(policy.policyId),
    pathSiblings: Array(8).fill('0'),
    pathBits: Array(8).fill('0'),
  };
}

async function syncCredentialRootOnChain(rootHex, env = process.env) {
  return syncCredentialRootViaSdk(rootHex, env);
}

module.exports = {
  buildCredentialMaterial,
  normalizeHex32,
  singleLeafRoot,
  syncCredentialRootOnChain,
};
