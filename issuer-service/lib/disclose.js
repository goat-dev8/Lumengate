const { createHash } = require('crypto');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const DATA_DIR = join(__dirname, '..', 'data');
const STORE_PATH = join(DATA_DIR, 'disclosures.json');

function stellarEnv() {
  const env = { ...process.env, PATH: process.env.PATH };
  delete env.STELLAR_NETWORK_PASSPHRASE;
  delete env.VITE_NETWORK_PASSPHRASE;
  return env;
}

function viewingKeyHash(viewingKey) {
  return createHash('sha256').update(String(viewingKey)).digest('hex');
}

function loadStore() {
  if (!existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveStore(rows) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(rows, null, 2));
}

async function verifyViewingKeyOnChain(env, auditorId, hashHex) {
  const registryId = env.AUDITOR_REGISTRY_ID || env.VITE_AUDITOR_REGISTRY_ID;
  if (!registryId) {
    throw new Error('AUDITOR_REGISTRY_ID not configured');
  }
  const rpcUrl = env.VITE_STELLAR_RPC_URL || env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const { execFileSync } = require('child_process');
  const out = execFileSync(
    'stellar',
    [
      'contract',
      'invoke',
      '--id',
      registryId,
      '--source-account',
      'deployer',
      '--network',
      'testnet',
      '--',
      'verify_viewing_key',
      '--auditor_id',
      String(auditorId),
      '--viewing_key_hash',
      hashHex,
    ],
    { encoding: 'utf8', env: { ...process.env, PATH: process.env.PATH } },
  );
  return out.trim().endsWith('true');
}

function hexToBytes32Arg(hex) {
  const h = String(hex || '').replace(/^0x/i, '').padStart(64, '0').slice(-64);
  if (!/^[0-9a-f]{64}$/i.test(h)) {
    throw new Error('expected 32-byte hex value');
  }
  return h;
}

function fieldToBytes32Hex(value) {
  if (value == null || value === '') throw new Error('missing 32-byte field');
  const s = String(value);
  if (/^0x[0-9a-f]+$/i.test(s) || /^[0-9a-f]{64}$/i.test(s)) return hexToBytes32Arg(s);
  return BigInt(s).toString(16).padStart(64, '0');
}

function ensureAdminKey(env = process.env) {
  const secret = env.CONTRACT_ADMIN_SECRET_KEY;
  if (!secret) throw new Error('CONTRACT_ADMIN_SECRET_KEY not configured');
  const { execFileSync } = require('child_process');
  execFileSync('stellar', ['network', 'use', 'testnet'], { env: stellarEnv() });
  execFileSync('stellar', ['keys', 'add', 'admin', '--secret-key', '--overwrite'], {
    input: secret,
    env: stellarEnv(),
  });
}

function recordDisclosureOnChain(pack, env = process.env) {
  const registryId = env.AUDITOR_REGISTRY_ID || env.VITE_AUDITOR_REGISTRY_ID;
  if (!registryId) return null;
  ensureAdminKey(env);
  const { execFileSync } = require('child_process');
  const nullifierHex = fieldToBytes32Hex(
    pack.nullifier || pack.proofPublicInputs?.nullifier || pack.credentialCommitment,
  );
  const txHex = fieldToBytes32Hex(
    pack.txHash || createHash('sha256').update(JSON.stringify(pack)).digest('hex'),
  );
  const vkHash = fieldToBytes32Hex(pack.viewingKeyHash);
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
      'testnet',
      '--send',
      'yes',
      '--',
      'record_disclosure',
      '--auditor_id',
      String(pack.auditorId || 1),
      '--viewing_key_hash',
      vkHash,
      '--tx_hash',
      txHex,
      '--nullifier',
      nullifierHex,
    ],
    { encoding: 'utf8', env: stellarEnv() },
  );
  return { txHash: txHex, nullifier: nullifierHex };
}

function appendDisclosure(pack) {
  const rows = loadStore();
  const stored = { ...pack, storedAt: Date.now() };
  try {
    recordDisclosureOnChain(stored);
    stored.onChain = true;
  } catch (err) {
    stored.onChain = false;
    stored.onChainError = err instanceof Error ? err.message : String(err);
  }
  rows.push(stored);
  saveStore(rows);
  return stored;
}

function queryDisclosures({ viewingKey, auditorId, txHash }) {
  const hash = viewingKeyHash(viewingKey);
  const rows = loadStore().filter((row) => {
    if (Number(row.auditorId) !== Number(auditorId)) return false;
    if (row.viewingKeyHash !== hash) return false;
    if (txHash && row.txHash !== txHash) return false;
    return true;
  });
  return rows.map(({ storedAt, viewingKeyHash: _vk, ...rest }) => rest);
}

module.exports = {
  viewingKeyHash,
  verifyViewingKeyOnChain,
  recordDisclosureOnChain,
  appendDisclosure,
  queryDisclosures,
};
