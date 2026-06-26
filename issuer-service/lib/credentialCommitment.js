const { execFileSync } = require('child_process');
const { createHash } = require('crypto');
const {
  fieldToBytes32Hex,
  hash2Fields,
  hash3Fields,
  toBigInt,
} = require('./poseidonFields');
const { policyByKey } = require('./policies');

function fieldFromHash(parts) {
  const h = createHash('sha256')
    .update(parts.map((p) => String(p)).join(':'))
    .digest('hex')
    .slice(0, 62);
  return BigInt(`0x${h}`).toString();
}

function normalizeHex32(hex) {
  return String(hex || '').replace(/^0x/i, '').toLowerCase().padStart(64, '0');
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
  const salt = fieldFromHash(['lumengate-credential-v1', walletField, policy.key, issuerId]);

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

function syncCredentialRootOnChain(rootHex, env = process.env) {
  const registryId = env.CREDENTIAL_REGISTRY_ID || env.VITE_CREDENTIAL_REGISTRY_ID;
  const secret = env.CONTRACT_ADMIN_SECRET_KEY;
  const admin = env.CONTRACT_ADMIN_PUBLIC_KEY;
  if (!registryId || !secret || !admin) return null;

  execFileSync('stellar', ['network', 'use', env.STELLAR_NETWORK_NAME || 'testnet'], { env: process.env });
  execFileSync('stellar', ['keys', 'add', 'admin', '--secret-key', '--overwrite'], {
    input: secret,
    env: process.env,
  });
  const root = normalizeHex32(rootHex);
  execFileSync(
    'stellar',
    [
      'contract',
      'invoke',
      '--id',
      registryId,
      '--source-account',
      'admin',
      '--network',
      env.STELLAR_NETWORK_NAME || 'testnet',
      '--send',
      'yes',
      '--',
      'set_root',
      '--caller',
      admin,
      '--root',
      root,
    ],
    { encoding: 'utf8', env: process.env },
  );
  return root;
}

module.exports = {
  buildCredentialMaterial,
  normalizeHex32,
  singleLeafRoot,
  syncCredentialRootOnChain,
};
