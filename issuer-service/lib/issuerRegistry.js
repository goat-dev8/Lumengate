const { execFileSync } = require('child_process');

function envTrim(v) {
  return v ? String(v).trim().replace(/\r$/, '') : '';
}

function registryId(env = process.env) {
  return envTrim(env.ISSUER_REGISTRY_ID || env.VITE_ISSUER_REGISTRY_ID);
}

function invokeRead(registry, fn, args) {
  const argv = [
    'contract',
    'invoke',
    '--id',
    registry,
    '--source-account',
    'deployer',
    '--network',
    'testnet',
    '--',
    fn,
    ...args,
  ];
  const out = execFileSync('stellar', argv, {
    encoding: 'utf8',
    env: { ...process.env, PATH: process.env.PATH },
  });
  return out.trim();
}

function getIssuerById(issuerId, env = process.env) {
  const id = registryId(env);
  if (!id) throw new Error('ISSUER_REGISTRY_ID not configured');
  const authorized = invokeRead(id, 'is_authorized', ['--issuer_id', String(issuerId)]);
  if (!authorized.endsWith('true')) {
    return { issuerId: Number(issuerId), authorized: false, pubkeyHex: null };
  }
  const pubkeyOut = invokeRead(id, 'get_pubkey', ['--issuer_id', String(issuerId)]);
  const pubkeyHex = pubkeyOut.replace(/"/g, '').trim();
  return {
    issuerId: Number(issuerId),
    authorized: true,
    pubkeyHex: pubkeyHex && pubkeyHex !== 'null' ? pubkeyHex : null,
    registryId: id,
    signatureScheme: 'ed25519',
  };
}

module.exports = { getIssuerById, registryId };
