#!/usr/bin/env node
/** Poseidon2 Merkle root over note commitments (8-level zero-padded tree). */
const { computeNoteRootFromLeaves } = require('../issuer-service/lib/poseidonFields');

const commitments = process.argv.slice(2);
if (!commitments.length) {
  console.log('0x0000000000000000000000000000000000000000000000000000000000000000');
  process.exit(0);
}

console.log(computeNoteRootFromLeaves(commitments));
