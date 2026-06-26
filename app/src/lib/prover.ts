import acvmWasm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noircWasm from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';
import type { IssuerCredentialResponse } from './config';
import {
  buildPublicInputsHex,
  bundleFromHonkProof,
  type ProofBundle,
} from './contracts';
import type { UltraHonkBackend } from '@aztec/bb.js';
import type { Noir } from '@noir-lang/noir_js';

let runtimeInitPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;
let noir: Noir | null = null;
let backend: UltraHonkBackend | null = null;

export async function initNoirRuntime(): Promise<void> {
  if (runtimeInitPromise) return runtimeInitPromise;
  runtimeInitPromise = (async () => {
    const [{ default: initACVM }, { default: initNoirC }] = await Promise.all([
      import('@noir-lang/acvm_js'),
      import('@noir-lang/noirc_abi'),
    ]);
    await Promise.all([initACVM(fetch(acvmWasm)), initNoirC(fetch(noircWasm))]);
  })();
  return runtimeInitPromise;
}

async function ensureProverReady(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await initNoirRuntime();
    const [{ Noir }, { UltraHonkBackend }] = await Promise.all([
      import('@noir-lang/noir_js'),
      import('@aztec/bb.js'),
    ]);
    const res = await fetch('/circuit/lumengate.json');
    const circuit = await res.json();
    noir = new Noir(circuit);
    backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
  })();
  return initPromise;
}

export async function warmProver(): Promise<void> {
  await ensureProverReady();
}

export type ProveProgress = {
  stage: 'init' | 'witness' | 'prove' | 'done' | 'error';
  message: string;
  percent: number;
};

function normalizeProverInputs(
  raw: Record<string, string | boolean | string[] | number[]>,
): Record<string, string | boolean | string[]> {
  const out: Record<string, string | boolean | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.map((entry) => String(entry));
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

export async function generateProof(
  credential: IssuerCredentialResponse,
  onProgress?: (p: ProveProgress) => void,
): Promise<{ bundle: ProofBundle; durationSec: number }> {
  const started = performance.now();
  onProgress?.({ stage: 'init', message: 'Loading prover…', percent: 10 });
  await ensureProverReady();
  if (!noir || !backend) throw new Error('Prover not initialized');

  const inputs = credential.proverInputs;
  if (!inputs) throw new Error('Issuer did not return prover inputs');

  onProgress?.({ stage: 'witness', message: 'Building private witness…', percent: 35 });
  const { witness } = await noir.execute(normalizeProverInputs(inputs));

  onProgress?.({ stage: 'prove', message: 'Confirming eligibility privately…', percent: 65 });
  // noir.execute() already returns gzip-compressed witness (magic 0x1f8b); bb.js gunzips once.
  const { proof, publicInputs } = await backend.generateProof(witness, { keccak: true });
  const bundle = bundleFromHonkProof(proof, publicInputs);

  onProgress?.({ stage: 'done', message: 'Passport ready', percent: 100 });
  const durationSec = (performance.now() - started) / 1000;

  return {
    durationSec,
    bundle,
  };
}

export function publicInputsPanel(bundle: ProofBundle): Array<{ label: string; value: string }> {
  return [
    { label: 'Eligibility record', value: bundle.publicInputs.root },
    { label: 'Restriction record', value: bundle.publicInputs.revocationRoot },
    { label: 'Eligibility plan', value: bundle.publicInputs.policyId },
    { label: 'Settlement reference', value: bundle.publicInputs.nullifier },
  ];
}

export function verifyPublicInputsMatchRoots(
  bundle: ProofBundle,
  roots: { root: string; revocationRoot: string },
): boolean {
  const expectedRoot = BigInt(roots.root.replace(/^0x/i, '0x')).toString(10);
  const expectedRev = BigInt(roots.revocationRoot.replace(/^0x/i, '0x')).toString(10);
  return (
    bundle.publicInputs.root === expectedRoot &&
    bundle.publicInputs.revocationRoot === expectedRev
  );
}

export { buildPublicInputsHex };
