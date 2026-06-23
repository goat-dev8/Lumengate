#!/usr/bin/env node
/**
 * Poseidon2 revocation root via circuit-compatible path witness
 * (compute_revocation_root in circuits/lumengate: cur=0, hash2(cur, sibling) per level).
 */
const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const MAIN = join(ROOT, 'circuits', 'lumengate', 'src', 'main.nr');
const CIRCUIT = join(ROOT, 'circuits', 'lumengate');

const EMPTY_REVOCATION_ROOT = '0x151e1f66eeb82f00af0d965d38a95b30cdc1ccf819d4f75c885b69a6879e0b76';

function hash2Fields(a, b) {
  const backup = readFileSync(MAIN, 'utf8');
  const test = `
#[test]
fn hash2_pair_runtime() {
    let a: Field = ${a.toString()};
    let b: Field = ${b.toString()};
    let h = hash2(a, b);
    println(f"hash2={h}");
}
`;
  writeFileSync(MAIN, backup + test);
  try {
    const out = execSync('nargo test hash2_pair_runtime --show-output', {
      cwd: CIRCUIT,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${process.env.HOME}/.nargo/bin:${process.env.PATH || ''}` },
    });
    const m = out.match(/hash2=(0x[0-9a-f]+|\d+)/i);
    if (!m) throw new Error(`hash2 failed: ${out}`);
    return BigInt(m[1]);
  } finally {
    writeFileSync(MAIN, backup);
  }
}

function hexToBigInt(hex) {
  const h = String(hex).replace(/^0x/i, '');
  if (!h || /^0+$/.test(h)) return 0n;
  return BigInt(`0x${h}`);
}

function fieldToBytes32Hex(val) {
  let h = val.toString(16);
  if (h.length > 64) {
    h = h.slice(h.length - 64);
  }
  return `0x${h.padStart(64, '0')}`;
}

function computeRevocationRootFromSiblings(siblings) {
  let acc = 0n;
  for (let i = 0; i < 8; i++) {
    const sib = siblings[i] ?? 0n;
    acc = hash2Fields(acc, sib);
  }
  return fieldToBytes32Hex(acc);
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
};

if (require.main === module) {
  console.log(computeRevocationWitness(process.argv.slice(2)).root);
}
