const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCommitment } = require('../lib/revoke');

test('normalizeCommitment lowercases hex prefix', () => {
  const hex = 'a'.repeat(64);
  assert.equal(normalizeCommitment(`0X${hex.toUpperCase()}`), `0x${hex}`);
});

test('normalizeCommitment rejects short hex', () => {
  assert.throws(() => normalizeCommitment('0x1234'), /32-byte hex/);
});
