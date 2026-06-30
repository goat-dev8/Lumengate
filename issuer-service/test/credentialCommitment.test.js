const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCredentialMaterial, singleLeafRoot } = require('../lib/credentialCommitment');

test('buildCredentialMaterial is deterministic per wallet', () => {
  const a = buildCredentialMaterial('wallet-42');
  const b = buildCredentialMaterial('wallet-42');
  assert.equal(a.commitment, b.commitment);
  assert.equal(a.root, b.root);
});

test('different wallets produce different commitments', () => {
  const a = buildCredentialMaterial('wallet-a');
  const b = buildCredentialMaterial('wallet-b');
  assert.notEqual(a.commitment, b.commitment);
});

test('singleLeafRoot matches buildCredentialMaterial root', () => {
  const material = buildCredentialMaterial('wallet-root');
  assert.equal(singleLeafRoot(material.commitment), material.root);
});

test('policy key affects prover jurisdiction bounds', () => {
  const general = buildCredentialMaterial('wallet-policy', process.env, 'general-eligibility');
  const us = buildCredentialMaterial('wallet-policy', process.env, 'us-jurisdiction');
  assert.equal(general.commitment, us.commitment);
  assert.notEqual(general.minJurisdiction, us.minJurisdiction);
});
