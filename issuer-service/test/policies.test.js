const test = require('node:test');
const assert = require('node:assert/strict');
const { policyByKey, policyList, POLICIES } = require('../lib/policies');

test('policyList returns six policies', () => {
  assert.equal(policyList().length, 6);
});

test('policyByKey resolves proof-of-funds policy id 2', () => {
  const pof = policyByKey('proof-of-funds');
  assert.equal(pof.policyId, 2);
  assert.equal(pof.fundsThreshold, 50);
});

test('policyByKey falls back to general-eligibility', () => {
  const policy = policyByKey('unknown-key');
  assert.equal(policy.key, POLICIES['general-eligibility'].key);
});
