#!/usr/bin/env node
/**
 * Generates valid Prover.toml + credential fixture for lumengate V3 circuit.
 */
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { randomBytes } = require('crypto');
const { join } = require('path');
const { readOnChainRoots } = require('../issuer-service/lib/onChainRoots');
const { signCommitment, issuerMetadata } = require('../issuer-service/lib/ed25519Issuer');
const { computeNullifier: poseidonNullifier } = require('../issuer-service/lib/poseidonFields');
const {
  buildCredentialMaterial,
  normalizeHex32,
  syncCredentialRootOnChain,
} = require('../issuer-service/lib/credentialCommitment');

const ROOT = join(__dirname, '..');
const ENV_PATH = join(ROOT, '.env');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function hexToBytes32(hex) {
  const h = hex.replace(/^0x/, '').padStart(64, '0');
  return Array.from(Buffer.from(h, 'hex'));
}

function fieldHexToDecimal(fieldHex) {
  return BigInt(fieldHex).toString();
}

function randomFieldSecret() {
  return BigInt(`0x${randomBytes(31).toString('hex')}`).toString();
}

function computeNullifier(noteSecret, policyId, assetId = '1', actionId = '1') {
  return poseidonNullifier(noteSecret, policyId, assetId, actionId);
}

const POLICY_OVERRIDES = {
  'general-eligibility': { min_jurisdiction: '1', max_jurisdiction: '999', policy_id: '1' },
  'accredited-investor': { min_jurisdiction: '1', max_jurisdiction: '999', policy_id: '1' },
  'us-jurisdiction': { min_jurisdiction: '840', max_jurisdiction: '840', policy_id: '1' },
  'sanctions-clear': { min_jurisdiction: '1', max_jurisdiction: '999', policy_id: '1' },
  'age-verified': { min_jurisdiction: '1', max_jurisdiction: '999', policy_id: '1' },
  'proof-of-funds': { min_jurisdiction: '1', max_jurisdiction: '999', policy_id: '2' },
};

function buildProverInputs(
  walletField,
  env,
  chainRoots,
  policyKey = 'general-eligibility',
  scope = {},
) {
  const policy = POLICY_OVERRIDES[policyKey] || POLICY_OVERRIDES['general-eligibility'];
  const material = buildCredentialMaterial(walletField, env, policyKey);
  const commitment = material.commitment;
  if (!chainRoots?.root || !chainRoots?.revocationRoot) {
    throw new Error('On-chain Merkle roots are required');
  }
  const root = chainRoots.root;
  if (normalizeHex32(root) !== normalizeHex32(material.root)) {
    throw new Error(
      `CredentialRegistry root (${root}) does not match credential root (${material.root}) for walletField=${walletField}.`,
    );
  }
  const revRoot = chainRoots.revocationRoot;
  const { computeRevocationWitness } = require('./compute_revocation_root.js');
  const { loadRevoked } = require('../issuer-service/lib/revoke');
  const revoked = loadRevoked().map((r) => r.commitment);
  let revWitness = computeRevocationWitness(revoked);
  const revRootNorm = String(revRoot).toLowerCase();
  if (revWitness.root.toLowerCase() !== revRootNorm) {
    throw new Error(
      `Revocation witness (${revWitness.root}) does not match on-chain root (${revRoot}). ` +
        'Sync issuer-service/fixtures/revoked_commitments.json with CredentialRegistry.',
    );
  }
  const noteSecret = randomFieldSecret();
  const noteBlinding = randomFieldSecret();
  const assetId = String(scope.assetId || scope.asset_id || '1');
  const actionId = String(scope.actionId || scope.action_id || '1');
  const nullifier = computeNullifier(noteSecret, policy.policy_id, assetId, actionId);
  const issuer = issuerMetadata(env);
  const issuerSig = signCommitment(commitment, env);
  return {
    commitment,
    nullifier,
    root,
    revRoot,
    policyKey,
    noteSecret,
    noteBlinding,
    issuer,
    issuerSignature: issuerSig,
    proverInputs: {
      accredited: true,
      sanctions_clear: true,
      jurisdiction_code: material.jurisdictionCode,
      dob_timestamp: material.dobTimestamp,
      issuer_id: material.issuerId,
      salt: material.salt,
      note_secret: noteSecret,
      note_blinding: noteBlinding,
      current_time: String(Math.floor(Date.now() / 1000)),
      min_jurisdiction: policy.min_jurisdiction,
      max_jurisdiction: policy.max_jurisdiction,
      policy_id: policy.policy_id,
      asset_id: assetId,
      action_id: actionId,
      root: fieldHexToDecimal(root),
      revocation_root: fieldHexToDecimal(revRoot),
      nullifier: fieldHexToDecimal(nullifier),
      path_siblings: material.pathSiblings,
      path_bits: material.pathBits,
      rev_path_siblings: revWitness.rev_path_siblings,
      rev_path_bits: revWitness.rev_path_bits,
    },
  };
}

async function main() {
  const env = loadEnv();
  const walletField = process.env.WALLET_FIELD || '42';
  const policyKey = process.env.POLICY_KEY || 'general-eligibility';
  const material = buildCredentialMaterial(walletField, env, policyKey);
  let chainRoots = await readOnChainRoots(env);
  if (normalizeHex32(chainRoots.root) !== normalizeHex32(material.root)) {
    syncCredentialRootOnChain(material.root, env);
    chainRoots = await readOnChainRoots(env);
  }
  const built = buildProverInputs(walletField, env, chainRoots, policyKey, {
    assetId: process.env.ASSET_ID || process.env.ASSET_SCOPE_ID,
    actionId: process.env.ACTION_ID || process.env.ACTION_SCOPE_ID,
  });
  const pi = built.proverInputs;
  const proverToml = `# Auto-generated by scripts/generate_prover_toml.js (V3 Ed25519 issuer, no in-circuit sig)
accredited = true
sanctions_clear = true
jurisdiction_code = "840"
dob_timestamp = "631152000"
issuer_id = "${pi.issuer_id}"
salt = "${pi.salt}"
note_secret = "${pi.note_secret}"
note_blinding = "${pi.note_blinding}"
current_time = "${pi.current_time}"
min_jurisdiction = "${pi.min_jurisdiction}"
max_jurisdiction = "${pi.max_jurisdiction}"
policy_id = "${pi.policy_id}"
asset_id = "${pi.asset_id}"
action_id = "${pi.action_id}"
root = "${pi.root}"
revocation_root = "${pi.revocation_root}"
nullifier = "${pi.nullifier}"
path_siblings = [${pi.path_siblings.map((v) => `"${v}"`).join(', ')}]
path_bits = [${pi.path_bits.map((v) => `"${v}"`).join(', ')}]
rev_path_siblings = [${pi.rev_path_siblings.map((v) => `"${v}"`).join(', ')}]
rev_path_bits = [${pi.rev_path_bits.map((v) => `"${v}"`).join(', ')}]
`;

  const outPath = join(ROOT, 'circuits', 'lumengate', 'Prover.toml');
  writeFileSync(outPath, proverToml);
  console.log('Wrote', outPath);

  const fixtureDir = join(ROOT, 'issuer-service', 'fixtures');
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(
    join(fixtureDir, 'credential.json'),
    JSON.stringify(
      {
        commitment: built.commitment,
        nullifier: built.nullifier,
        root: built.root,
        revocationRoot: built.revRoot,
        policyId: 1,
        assetId: Number(pi.asset_id),
        actionId: Number(pi.action_id),
        issuerId: Number(env.ISSUER_ID || env.ISSUER_ETH_ID || 2),
        pubkeyBytes64: built.issuer.pubkeyBytes64,
        stellarPublicKey: built.issuer.stellarPublicKey,
        signatureScheme: 'ed25519',
        issuerSignatureBase64: built.issuerSignature.signatureBase64,
        noteSecret: built.noteSecret,
        noteBlinding: built.noteBlinding,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { buildProverInputs, computeNullifier };
