const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeNullifier,
  computeNoteCommitment,
  computePolicyNullifier,
  fieldToBytes32Hex,
  hash2Fields,
  toBigInt,
} = require('../lib/poseidonFields');

test('toBigInt parses decimal and hex', () => {
  assert.equal(toBigInt('42'), 42n);
  assert.equal(toBigInt('0x2a'), 42n);
});

test('fieldToBytes32Hex pads to 32 bytes', () => {
  assert.match(fieldToBytes32Hex(1n), /^0x0{62}01$/);
});

test('hash2Fields is deterministic', () => {
  assert.equal(String(hash2Fields(1, 2)), String(hash2Fields(1, 2)));
});

test('computeNullifier includes asset and action scope', () => {
  const scoped = computeNullifier('123', 1, 2, 1);
  const policyOnly = computePolicyNullifier('123', 1);
  assert.notEqual(scoped, policyOnly);
  assert.match(scoped, /^0x[0-9a-f]{64}$/);
});

test('computeNoteCommitment is stable for fixed inputs', () => {
  const a = computeNoteCommitment('10', '20');
  const b = computeNoteCommitment('10', '20');
  assert.equal(a, b);
});
