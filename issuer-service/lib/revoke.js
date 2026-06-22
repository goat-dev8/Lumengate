const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const DATA_DIR = join(__dirname, '..', 'data');
const REVOKED_PATH = join(DATA_DIR, 'revoked_commitments.json');

function loadRevoked() {
  if (!existsSync(REVOKED_PATH)) return [];
  try {
    return JSON.parse(readFileSync(REVOKED_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveRevoked(rows) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(REVOKED_PATH, JSON.stringify(rows, null, 2));
}

function normalizeCommitment(hex) {
  const h = String(hex).replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) {
    throw new Error('commitment must be 32-byte hex');
  }
  return `0x${h}`;
}

function stellarEnv() {
  const env = { ...process.env, PATH: process.env.PATH };
  delete env.STELLAR_NETWORK_PASSPHRASE;
  delete env.VITE_NETWORK_PASSPHRASE;
  return env;
}

function ensureAdminKey() {
  const secret = process.env.CONTRACT_ADMIN_SECRET_KEY;
  if (!secret) throw new Error('CONTRACT_ADMIN_SECRET_KEY not configured');
  execFileSync('stellar', ['network', 'use', 'testnet'], {
    encoding: 'utf8',
    env: stellarEnv(),
  });
  execFileSync('stellar', ['keys', 'add', 'admin', '--secret-key', '--overwrite'], {
    input: secret,
    encoding: 'utf8',
    env: stellarEnv(),
  });
}

/**
 * Revoke a credential commitment: persist locally and update CredentialRegistry revocation root on-chain.
 * Revocation root = Poseidon2 Merkle root of revoked commitment leaves (production path via nargo).
 */
async function revokeCredential({ commitment, reason, env = process.env }) {
  const normalized = normalizeCommitment(commitment);
  const rows = loadRevoked();
  if (rows.some((r) => r.commitment === normalized)) {
    const existing = rows.find((r) => r.commitment === normalized);
    if (existing?.onChain) {
      return { alreadyRevoked: true, commitment: normalized, count: rows.length, onChain: true };
    }
  } else {
    rows.push({
      commitment: normalized,
      reason: reason || 'issuer-revoked',
      revokedAt: Date.now(),
      onChain: false,
    });
    saveRevoked(rows);
  }

  const registryId = env.CREDENTIAL_REGISTRY_ID || env.VITE_CREDENTIAL_REGISTRY_ID;
  const admin = env.CONTRACT_ADMIN_PUBLIC_KEY;
  if (!registryId || !admin) {
    throw new Error('CREDENTIAL_REGISTRY_ID and CONTRACT_ADMIN_PUBLIC_KEY required');
  }

  const { computeRevocationWitness } = require('../../scripts/compute_revocation_root.js');
  const { root: newRevRoot } = computeRevocationWitness(rows.map((r) => r.commitment));

  ensureAdminKey();
  const revRootArg = newRevRoot.replace(/^0x/i, '');
  const out = execFileSync(
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
      'set_revocation_root',
      '--caller',
      admin,
      '--revocation_root',
      revRootArg,
    ],
    { encoding: 'utf8', env: stellarEnv() },
  );

  const txMatch = out.match(/[a-f0-9]{64}/);
  const idx = rows.findIndex((r) => r.commitment === normalized);
  if (idx >= 0) {
    rows[idx].onChain = true;
    rows[idx].txHash = txMatch ? txMatch[0] : null;
    saveRevoked(rows);
  }
  return {
    alreadyRevoked: false,
    commitment: normalized,
    revocationRoot: newRevRoot,
    count: rows.length,
    onChain: true,
    txHash: txMatch ? txMatch[0] : null,
  };
}

module.exports = { revokeCredential, loadRevoked, normalizeCommitment };
