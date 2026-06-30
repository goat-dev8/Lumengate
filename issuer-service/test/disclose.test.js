const test = require('node:test');
const assert = require('node:assert/strict');
const { viewingKeyHash } = require('../lib/disclose');

test('viewingKeyHash is sha256 hex of viewing key', () => {
  const key = 'lgvk_test-key-material';
  const hash = viewingKeyHash(key);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(viewingKeyHash(key), hash);
});

test('viewingKeyHash differs for different keys', () => {
  assert.notEqual(viewingKeyHash('lgvk_a'), viewingKeyHash('lgvk_b'));
});
