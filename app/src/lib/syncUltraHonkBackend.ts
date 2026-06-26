/**
 * Browser-safe UltraHonk prover using BarretenbergSync (main thread).
 *
 * @aztec/bb.js UltraHonkBackend always spawns main.worker.js via Comlink, which
 * can hang indefinitely under cross-origin isolation even with threads: 1.
 * BarretenbergSync runs the same WASM on the main thread and completes reliably.
 */
import {
  BarretenbergSync,
  Crs,
  RawBuffer,
  deflattenFields,
  splitHonkProof,
} from '@aztec/bb.js';
import { gunzipSync, inflateSync, unzlibSync } from 'fflate';

type SyncApi = Awaited<ReturnType<typeof BarretenbergSync.initSingleton>>;

const PAIRING_POINTS_SIZE = 16;

function decompressBytes(data: Uint8Array): Uint8Array {
  if (data[0] === 31 && data[1] === 139 && data[2] === 8) {
    return gunzipSync(data);
  }
  if ((data[0] & 15) !== 8 || data[0] >> 4 > 7 || ((data[0] << 8) | data[1]) % 31) {
    return inflateSync(data);
  }
  return unzlibSync(data);
}

function base64ToBytes(input: string): Uint8Array {
  const binary = atob(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function acirBytecodeToBytes(base64EncodedBytecode: string): Uint8Array {
  return decompressBytes(base64ToBytes(base64EncodedBytecode));
}

function bbLogger(msg: string): void {
  if (import.meta.env?.DEV) {
    console.debug('[bb.js:sync]', msg);
  }
}

let syncApi: SyncApi | null = null;
let syncApiInitPromise: Promise<SyncApi> | null = null;
let syncApiBytecodeKey: string | null = null;

async function initSrsForCircuit(api: SyncApi, uncompressedBytecode: Uint8Array): Promise<void> {
  const [, subgroupSize] = api.acirGetCircuitSizes(uncompressedBytecode, false, true);
  const crs = await Crs.new(subgroupSize + 1, undefined, bbLogger);
  api.srsInitSrs(
    new RawBuffer(crs.getG1Data()),
    crs.numPoints,
    new RawBuffer(crs.getG2Data()),
  );
}

async function getSyncApi(acirBytecode: string): Promise<SyncApi> {
  if (!syncApiInitPromise) {
    syncApiInitPromise = BarretenbergSync.initSingleton(undefined, bbLogger);
  }
  syncApi = await syncApiInitPromise;
  if (syncApiBytecodeKey !== acirBytecode) {
    const uncompressed = acirBytecodeToBytes(acirBytecode);
    await initSrsForCircuit(syncApi, uncompressed);
    syncApiBytecodeKey = acirBytecode;
  }
  return syncApi;
}

export type HonkProofResult = {
  proof: Uint8Array;
  publicInputs: string[];
};

export class SyncUltraHonkBackend {
  private readonly acirBytecode: string;
  private readonly acirUncompressedBytecode: Uint8Array;

  constructor(acirBytecode: string) {
    this.acirBytecode = acirBytecode;
    this.acirUncompressedBytecode = acirBytecodeToBytes(acirBytecode);
  }

  async generateProof(
    compressedWitness: Uint8Array,
    options?: { keccak?: boolean },
  ): Promise<HonkProofResult> {
    const api = await getSyncApi(this.acirBytecode);
    const witness = decompressBytes(compressedWitness);
    const proveUltraHonk = options?.keccak
      ? api.acirProveUltraKeccakHonk.bind(api)
      : api.acirProveUltraHonk.bind(api);
    const writeVkUltraHonk = options?.keccak
      ? api.acirWriteVkUltraKeccakHonk.bind(api)
      : api.acirWriteVkUltraHonk.bind(api);

    const proofWithPublicInputs = proveUltraHonk(
      this.acirUncompressedBytecode,
      witness,
    );
    const vk = writeVkUltraHonk(this.acirUncompressedBytecode);
    const vkAsFields = api.acirVkAsFieldsUltraHonk(new RawBuffer(vk));
    const numPublicInputs =
      Number(vkAsFields[1].toString()) - PAIRING_POINTS_SIZE;
    const { proof, publicInputs: publicInputsBytes } = splitHonkProof(
      proofWithPublicInputs,
      numPublicInputs,
    );
    return {
      proof,
      publicInputs: deflattenFields(publicInputsBytes),
    };
  }

  async destroy(): Promise<void> {
    // BarretenbergSync is reused across proofs; WASM teardown is expensive.
  }
}
