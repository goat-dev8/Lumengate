#!/usr/bin/env node
/**
 * Poseidon2 revocation root via circuit-compatible path witness
 * (compute_revocation_root in circuits/lumengate: cur=0, hash2(cur, sibling) per level).
 */
const {
  EMPTY_REVOCATION_ROOT,
  computeRevocationRootFromSiblings,
  fieldToBytes32Hex,
  hash2Fields,
  toBigInt,
} = require('../issuer-service/lib/poseidonFields');

function hexToBigInt(hex) {
  const h = String(hex).replace(/^0x/i, '');
  if (!h || /^0+$/.test(h)) return 0n;
  return BigInt(`0x${h}`);
}

/**
 * Encode revoked commitments as rev_path_siblings (circuit witness model).
 * Up to 8 revocations at consecutive depth levels with bit=0.
 */
function computeRevocationWitness(revokedCommitments) {
  const sibs = Array(8).fill(0n);
  const list = (revokedCommitments || []).slice(0, 8);
  for (let i = 0; i < list.length; i++) {
    sibs[i] = hexToBigInt(list[i]);
  }
  const root =
    list.length === 0 ? EMPTY_REVOCATION_ROOT : computeRevocationRootFromSiblings(sibs);
  return {
    root,
    rev_path_siblings: sibs.map((v) => v.toString()),
    rev_path_bits: Array(8).fill('0'),
  };
}

/** @deprecated use computeRevocationWitness */
function computeRevocationRootForCommitments(commitments, _baseRootHex = '0x0') {
  return computeRevocationWitness(commitments).root;
}

module.exports = {
  EMPTY_REVOCATION_ROOT,
  computeRevocationRootForCommitments,
  computeRevocationRootFromSiblings,
  computeRevocationWitness,
  hash2Fields,
  fieldToBytes32Hex,
  hexToBigInt,
};

if (require.main === module) {
  console.log(computeRevocationWitness(process.argv.slice(2)).root);
}
