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

/** bb.js IndexedDB cache keys (must match @aztec/bb.js CachedNetCrs). */
const CRS_IDB_DB = 'keyval-store';
const CRS_IDB_STORE = 'keyval';
const CRS_G1_KEY = 'g1Data';
const CRS_G2_KEY = 'g2Data';
/** Headroom for lumengate circuit SRS (see scripts/fetch_crs_assets.mjs). */
const CRS_NUM_POINTS = 65537;
const CRS_G1_MIN_BYTES = CRS_NUM_POINTS * 64;

const WITNESS_TIMEOUT_MS = 120_000;
const PROVE_TIMEOUT_MS = 600_000;

let runtimeInitPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;
let noir: Noir | null = null;
let backend: UltraHonkBackend | null = null;
let circuitBytecode: string | null = null;
let UltraHonkBackendCtor: typeof import('@aztec/bb.js').UltraHonkBackend | null = null;

export type ProverEnvironmentStatus = {
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  ready: boolean;
};

export async function getProverEnvironmentStatus(): Promise<ProverEnvironmentStatus> {
  const crossOriginIsolated =
    typeof window !== 'undefined' && typeof self.crossOriginIsolated !== 'undefined'
      ? self.crossOriginIsolated
      : true;
  const sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  return {
    crossOriginIsolated,
    sharedArrayBuffer,
    ready: crossOriginIsolated && sharedArrayBuffer,
  };
}

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
    UltraHonkBackendCtor = UltraHonkBackend;
    const res = await fetch('/circuit/lumengate.json');
    if (!res.ok) throw new Error(`Circuit artifact missing (${res.status})`);
    const circuit = await res.json();
    circuitBytecode = circuit.bytecode;
    noir = new Noir(circuit);
  })();
  return initPromise;
}

function openCrsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CRS_IDB_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(CRS_IDB_STORE)) {
        req.result.createObjectStore(CRS_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbSet(key: string, value: Uint8Array): Promise<void> {
  const db = await openCrsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRS_IDB_STORE, 'readwrite');
    tx.objectStore(CRS_IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB set ${key} failed`));
  });
}

function createBackend(): UltraHonkBackend {
  if (!circuitBytecode) throw new Error('Circuit bytecode not loaded');
  if (!UltraHonkBackendCtor) throw new Error('Prover backend library not loaded');
  return new UltraHonkBackendCtor(circuitBytecode, {
    threads: 1,
    memory: {
      initial: 1024,
      maximum: 65536,
    },
    logger: import.meta.env.DEV ? (msg: string) => console.debug('[bb.js]', msg) : undefined,
  });
}

/** Seed bb.js CRS cache from same-origin static files (avoids slow/hung CDN fetch in worker). */
export async function preloadCrsFromOrigin(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const [g1Res, g2Res] = await Promise.all([fetch('/crs/g1.dat'), fetch('/crs/g2.dat')]);
  if (!g1Res.ok || !g2Res.ok) {
    throw new Error(
      `Proving keys missing on server (g1=${g1Res.status}, g2=${g2Res.status}). Rebuild the app with scripts/fetch_crs_assets.mjs.`,
    );
  }

  const [g1Data, g2Data] = await Promise.all([
    new Uint8Array(await g1Res.arrayBuffer()),
    new Uint8Array(await g2Res.arrayBuffer()),
  ]);

  if (g1Data.length < CRS_G1_MIN_BYTES) {
    throw new Error(`Local g1.dat too small (${g1Data.length} bytes); rerun scripts/fetch_crs_assets.mjs`);
  }

  await idbSet(CRS_G1_KEY, g1Data);
  await idbSet(CRS_G2_KEY, g2Data);
}

export async function warmProver(onProgress?: (p: ProveProgress) => void): Promise<void> {
  assertProverEnvironment();
  onProgress?.({ stage: 'init', message: 'Loading zero-knowledge circuit…', percent: 8 });
  await ensureProverReady();
  onProgress?.({ stage: 'init', message: 'Loading proving keys into private browser storage…', percent: 14 });
  await preloadCrsFromOrigin();
  onProgress?.({ stage: 'init', message: 'Private prover ready', percent: 25 });
}

function assertProverEnvironment(): void {
  if (typeof window !== 'undefined' && typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
    throw new Error(
      'Private eligibility prover requires a cross-origin isolated page (COOP/COEP). ' +
        'Redeploy the app with security headers enabled, then hard-refresh.',
    );
  }
}

export type ProveProgress = {
  stage: 'init' | 'witness' | 'prove' | 'done' | 'error';
  message: string;
  percent: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

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
  onProgress?.({ stage: 'init', message: 'Preparing private prover…', percent: 10 });
  assertProverEnvironment();
  await warmProver(onProgress);
  if (!noir) throw new Error('Prover not initialized');

  const inputs = credential.proverInputs;
  if (!inputs) throw new Error('Issuer did not return prover inputs');

  onProgress?.({ stage: 'witness', message: 'Building private witness…', percent: 40 });
  const { witness } = await withTimeout(
    noir.execute(normalizeProverInputs(inputs)),
    WITNESS_TIMEOUT_MS,
    'Witness generation timed out. Request a fresh passport and try again.',
  );

  onProgress?.({
    stage: 'prove',
    message: 'Starting private prover worker. First proof may take several minutes…',
    percent: 55,
  });

  backend = createBackend();
  let proofData: Awaited<ReturnType<UltraHonkBackend['generateProof']>>;
  try {
    proofData = await withTimeout(
      backend.generateProof(witness, { keccak: true }),
      PROVE_TIMEOUT_MS,
      'Proof generation timed out while the private prover worker was running. Close other heavy tabs and try again; your identity data was not sent anywhere.',
    );
  } catch (err) {
    const failedBackend = backend;
    backend = null;
    void failedBackend.destroy().catch(() => undefined);
    throw err;
  }

  const { proof, publicInputs } = proofData;
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
