#!/usr/bin/env node
/**
 * Generates Prover.toml for proof_of_funds circuit (V3 — no public wallet).
 */
const { readFileSync, writeFileSync } = require('fs');
const { randomBytes } = require('crypto');
const { join } = require('path');
const { computePolicyNullifier: poseidonNullifier } = require('../issuer-service/lib/poseidonFields');

const ROOT = join(__dirname, '..');
const CIRCUIT = join(ROOT, 'circuits', 'proof_of_funds');

function randomFieldSecret() {
  return BigInt(`0x${randomBytes(31).toString('hex')}`).toString();
}

function computeNullifier(noteSecret, policyId = '2') {
  return poseidonNullifier(noteSecret, policyId);
}

function buildPofProverInputs(_walletField, balance, threshold = 50) {
  const noteSecret = randomFieldSecret();
  const nullifier = computeNullifier(noteSecret, '2');
  return {
    nullifier,
    noteSecret,
    proverInputs: {
      root: '0',
      revocation_root: '0',
      policy_id: '2',
      nullifier: BigInt(nullifier).toString(10),
      balance: String(balance),
      threshold: String(threshold),
      note_secret: noteSecret,
    },
  };
}

if (require.main === module) {
  const walletField = process.env.WALLET_FIELD || '200';
  const balance = process.env.RWA_BALANCE || '100';
  const threshold = process.env.POF_THRESHOLD || '50';
  const built = buildPofProverInputs(walletField, balance, threshold);
  const toml = Object.entries(built.proverInputs)
    .map(([k, v]) => `${k} = "${v}"`)
    .join('\n');
  writeFileSync(join(CIRCUIT, 'Prover.toml'), `${toml}\n`);
  console.log(JSON.stringify(built, null, 2));
}

module.exports = { buildPofProverInputs, computeNullifier };
