const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSignedSorobanXdr,
  SMART_ACCOUNT_DEPLOYER_PUBLIC_KEY,
} = require('../lib/relayerXdrNormalize');

test('normalizeSignedSorobanXdr returns empty for blank input', async () => {
  assert.equal(await normalizeSignedSorobanXdr(''), '');
  assert.equal(await normalizeSignedSorobanXdr('   '), '');
});

test('SMART_ACCOUNT_DEPLOYER_PUBLIC_KEY is a valid G-address', () => {
  assert.match(SMART_ACCOUNT_DEPLOYER_PUBLIC_KEY, /^G[A-Z2-7]{55}$/);
});
