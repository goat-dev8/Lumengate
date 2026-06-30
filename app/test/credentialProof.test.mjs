import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedNullifierForCredential,
  proofMatchesCredential,
} from '../src/lib/credentialProof.ts';

const credential = {
  credential: { policyId: '1', nullifier: '999' },
  proverInputs: { policy_id: '1', nullifier: '999' },
};

const matchingProof = {
  publicInputs: {
    policyId: '1',
    nullifier: '999',
    assetId: '2',
    actionId: '1',
  },
};

const wrongProof = {
  publicInputs: {
    policyId: '1',
    nullifier: '111',
    assetId: '2',
    actionId: '1',
  },
};

test('expectedNullifierForCredential reads proverInputs nullifier', () => {
  assert.equal(expectedNullifierForCredential(credential, matchingProof), '999');
});

test('proofMatchesCredential accepts matching scoped proof', () => {
  assert.equal(proofMatchesCredential(matchingProof, credential), true);
});

test('proofMatchesCredential rejects mismatched nullifier', () => {
  assert.equal(proofMatchesCredential(wrongProof, credential), false);
});

test('proofMatchesCredential rejects missing credential', () => {
  assert.equal(proofMatchesCredential(matchingProof, null), false);
});
