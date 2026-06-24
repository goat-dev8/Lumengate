/**
 * Circuit-compatible Poseidon2 field ops (matches circuits/lumengate hash2/hash3).
 * Pure JS — no nargo required at runtime (Render/production safe).
 */
const { poseidon2Hash } = require('@zkpassport/poseidon2');

function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  const s = String(value).trim();
  if (!s) return 0n;
  if (s.startsWith('0x') || s.startsWith('0X')) return BigInt(s);
  return BigInt(s);
}

function fieldToBytes32Hex(val) {
  let h = toBigInt(val).toString(16);
  if (h.length > 64) h = h.slice(h.length - 64);
  return `0x${h.padStart(64, '0')}`;
}

function hash2Fields(a, b) {
  return poseidon2Hash([toBigInt(a), toBigInt(b)]);
}

function hash3Fields(a, b, c) {
  return poseidon2Hash([toBigInt(a), toBigInt(b), toBigInt(c)]);
}

function computeNullifier(noteSecret, policyId) {
  return fieldToBytes32Hex(hash2Fields(noteSecret, policyId));
}

function computeNoteCommitment(noteSecret, noteBlinding) {
  return fieldToBytes32Hex(hash2Fields(noteSecret, noteBlinding));
}

/** 8-level accumulator: acc = hash2(acc, leaf[i]) starting from 0. */
function computeNoteRootFromLeaves(leaves) {
  const padded = (leaves || []).map((l) => toBigInt(l));
  while (padded.length < 8) padded.push(0n);
  let acc = 0n;
  for (let i = 0; i < 8; i++) {
    acc = hash2Fields(acc, padded[i]);
  }
  return fieldToBytes32Hex(acc);
}

function computeRevocationRootFromSiblings(siblings) {
  let acc = 0n;
  for (let i = 0; i < 8; i++) {
    const sib = siblings[i] ?? 0n;
    acc = hash2Fields(acc, toBigInt(sib));
  }
  return fieldToBytes32Hex(acc);
}

const EMPTY_REVOCATION_ROOT = computeRevocationRootFromSiblings(Array(8).fill(0n));

module.exports = {
  EMPTY_REVOCATION_ROOT,
  computeNullifier,
  computeNoteCommitment,
  computeNoteRootFromLeaves,
  computeRevocationRootFromSiblings,
  fieldToBytes32Hex,
  hash2Fields,
  hash3Fields,
  toBigInt,
};
