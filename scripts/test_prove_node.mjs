#!/usr/bin/env node
/** End-to-end Noir + UltraHonk prove in Node (validates circuit + inputs). */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const walletField = process.argv[2];
  if (!walletField) {
    console.error('Usage: node scripts/test_prove_node.mjs <walletFieldHex>');
    process.exit(1);
  }

  const issuerUrl = process.env.ISSUER_URL || 'https://lumengate-issuer.onrender.com';
  let credential;
  if (process.env.CREDENTIAL_JSON) {
    credential = JSON.parse(process.env.CREDENTIAL_JSON);
  } else {
    const credRes = await fetch(`${issuerUrl}/credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletField, policyKey: 'general-eligibility' }),
    });
    if (!credRes.ok) {
      throw new Error(`Credential failed ${credRes.status}: ${await credRes.text()}`);
    }
    credential = await credRes.json();
  }
  if (!credential.proverInputs) throw new Error('No proverInputs');

  const { Noir } = await import('@noir-lang/noir_js');
  const { UltraHonkBackend } = await import('@aztec/bb.js');
  const circuitPath = join(ROOT, 'app/public/circuit/lumengate.json');
  const circuit = JSON.parse(readFileSync(circuitPath, 'utf8'));

  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

  const inputs = credential.proverInputs;
  const normalized = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (typeof v === 'boolean') normalized[k] = v;
    else if (Array.isArray(v)) normalized[k] = v.map(String);
    else normalized[k] = String(v);
  }

  console.log('Executing witness…');
  const t0 = Date.now();
  const { witness } = await noir.execute(normalized);
  console.log(`Witness OK in ${((Date.now() - t0) / 1000).toFixed(1)}s, len=${witness.length}`);

  console.log('Generating UltraHonk proof (keccak)…');
  const t1 = Date.now();
  const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
  console.log(`Proof OK in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  console.log('proof bytes', proof.length, 'publicInputs fields', publicInputs.length);
  await backend.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
