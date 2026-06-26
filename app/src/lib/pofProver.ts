import type { DeploymentConfig } from './config';
import type { ProofBundle } from './contracts';
import { bundleFromHonkProof, assertProofBundleForChain } from './contracts';
import { initNoirRuntime } from './prover';

let pofInit: Promise<{ noir: import('@noir-lang/noir_js').Noir; backend: import('@aztec/bb.js').UltraHonkBackend }> | null = null;

function randomFieldSecret(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return BigInt(`0x${hex}`).toString(10);
}

async function fetchPofNullifier(issuerServiceUrl: string, noteSecret: string): Promise<string> {
  const res = await fetch(`${issuerServiceUrl.replace(/\/$/, '')}/pof/nullifier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noteSecret, policyId: '2' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/pof/nullifier failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { nullifier: string };
  return json.nullifier;
}

async function ensurePofProver() {
  if (pofInit) return pofInit;
  pofInit = (async () => {
    await initNoirRuntime();
    const { Noir } = await import('@noir-lang/noir_js');
    const { UltraHonkBackend } = await import('@aztec/bb.js');
    const res = await fetch('/circuit/proof_of_funds.json');
    if (!res.ok) {
      throw new Error('Proof-of-funds circuit missing — run scripts/build_pof_circuit.sh');
    }
    const circuit = await res.json();
    const noir = new Noir(circuit);
    const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
    return { noir, backend };
  })();
  return pofInit;
}

export async function generatePofProof(
  config: DeploymentConfig,
  input: {
    walletField: string;
    balance: bigint;
    threshold: bigint;
  },
): Promise<ProofBundle> {
  if (input.balance < input.threshold) {
    throw new Error(
      `Balance ${input.balance.toString()} is below threshold ${input.threshold.toString()}`,
    );
  }
  const noteSecret = randomFieldSecret();
  const nullifier = await fetchPofNullifier(config.issuerServiceUrl, noteSecret);
  const proverInputs = {
    root: '0',
    revocation_root: '0',
    policy_id: '2',
    nullifier,
    balance: input.balance.toString(),
    threshold: input.threshold.toString(),
    note_secret: noteSecret,
  };
  const { noir, backend } = await ensurePofProver();
  const { witness } = await noir.execute(proverInputs);
  const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
  const bundle = bundleFromHonkProof(proof, publicInputs);
  assertProofBundleForChain(bundle);
  if (Number(bundle.publicInputs.policyId) !== 2) {
    throw new Error(`Expected policy_id 2, got ${bundle.publicInputs.policyId}`);
  }
  return bundle;
}
