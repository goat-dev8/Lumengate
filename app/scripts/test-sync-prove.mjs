import { readFileSync } from 'fs';
import { SyncUltraHonkBackend } from '../src/lib/syncUltraHonkBackend.ts';
import { Noir } from '@noir-lang/noir_js';

async function main() {
  const walletField =
    process.argv[2] ||
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const issuerUrl = process.env.ISSUER_URL || 'http://127.0.0.1:3001';

  const credRes = await fetch(`${issuerUrl}/credential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletField, policyKey: 'general-eligibility' }),
  });
  if (!credRes.ok) throw new Error(`Credential failed ${credRes.status}: ${await credRes.text()}`);
  const credential = await credRes.json();
  if (!credential.proverInputs) throw new Error('No proverInputs');

  const circuit = JSON.parse(readFileSync('./public/circuit/lumengate.json', 'utf8'));
  const noir = new Noir(circuit);
  const backend = new SyncUltraHonkBackend(circuit.bytecode);

  const normalized = {};
  for (const [k, v] of Object.entries(credential.proverInputs)) {
    if (typeof v === 'boolean') normalized[k] = v;
    else if (Array.isArray(v)) normalized[k] = v.map(String);
    else normalized[k] = String(v);
  }

  console.log('Executing witness…');
  const t0 = Date.now();
  const { witness } = await noir.execute(normalized);
  console.log(`Witness OK in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  console.log('Generating sync UltraHonk proof (keccak)…');
  const t1 = Date.now();
  const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
  console.log(`Proof OK in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  console.log('proof bytes', proof.length, 'publicInputs fields', publicInputs.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
