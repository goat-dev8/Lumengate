import {
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  StrKey,
  Account,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';
import { bytesToHex } from './utils';

export type ProofBundle = {
  proofHex: string;
  publicInputsHex: string;
  publicInputs: {
    root: string;
    revocationRoot: string;
    policyId: string;
    nullifier: string;
  };
};

/** Must match `ultrahonk_soroban_verifier::PROOF_BYTES` (bb 0.87 UltraHonk). */
export const ULTRA_HONK_PROOF_BYTES = 14_592;
/** Four BN254 public inputs × 32 bytes (V3 private note binding — no public wallet). */
export const PUBLIC_INPUTS_BYTES = 128;

function server(rpcUrl: string) {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
}

function readOnlyLedgerAccount(): Account {
  return new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
}

export async function readOnChainRoots(config: DeploymentConfig): Promise<{ root: string; revocationRoot: string }> {
  const s = server(config.rpcUrl);
  const contract = new Contract(config.credentialRegistryId);
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('get_roots'))
    .setTimeout(30)
    .build();

  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const val = sim.result?.retval;
  if (!val) throw new Error('No return value from get_roots');
  const tuple = scValToNative(val) as [Buffer | Uint8Array, Buffer | Uint8Array];
  return {
    root: `0x${bytesToHex(Uint8Array.from(tuple[0]))}`,
    revocationRoot: `0x${bytesToHex(Uint8Array.from(tuple[1]))}`,
  };
}

export async function readBalance(config: DeploymentConfig, holder: string): Promise<string> {
  const s = server(config.rpcUrl);
  const contract = new Contract(config.rwaTokenId);
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('balance', nativeToScVal(holder, { type: 'address' })))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const val = sim.result?.retval;
  if (!val) throw new Error('No balance returned');
  return String(scValToNative(val));
}

export async function readIsFrozen(config: DeploymentConfig, holder: string): Promise<boolean> {
  const s = server(config.rpcUrl);
  const contract = new Contract(config.rwaTokenId);
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('is_frozen', nativeToScVal(holder, { type: 'address' })))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const val = sim.result?.retval;
  if (!val) return false;
  return Boolean(scValToNative(val));
}

export async function readNullifierSpent(
  config: DeploymentConfig,
  nullifierHex: string,
  policyId?: number,
): Promise<boolean> {
  const s = server(config.rpcUrl);
  const contract = new Contract(config.policyVerifierId);
  const nullifierBytes = Buffer.from(nullifierHex.replace(/^0x/, ''), 'hex');
  const pid = policyId ?? config.policyId;
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'is_nullifier_spent',
        nativeToScVal(pid, { type: 'u32' }),
        xdr.ScVal.scvBytes(nullifierBytes),
      ),
    )
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const val = sim.result?.retval;
  if (!val) return false;
  return Boolean(scValToNative(val));
}

function scBytesFromHex(hex: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(hex.replace(/^0x/, ''), 'hex'));
}

export function assertProofBundleForChain(proof: ProofBundle): void {
  const proofLen = Buffer.from(proof.proofHex.replace(/^0x/, ''), 'hex').length;
  const piLen = Buffer.from(proof.publicInputsHex.replace(/^0x/, ''), 'hex').length;
  if (proofLen !== ULTRA_HONK_PROOF_BYTES) {
    throw new Error(
      `Invalid proof size: expected ${ULTRA_HONK_PROOF_BYTES} bytes, got ${proofLen}. Regenerate proof.`,
    );
  }
  if (piLen !== PUBLIC_INPUTS_BYTES) {
    throw new Error(
      `Invalid public inputs size: expected ${PUBLIC_INPUTS_BYTES} bytes, got ${piLen}. Regenerate proof.`,
    );
  }
}

export async function readUsdcSacBalance(config: DeploymentConfig, holder: string): Promise<string> {
  return readSacBalance(config, config.usdcSacId, holder);
}

export async function readEurcSacBalance(config: DeploymentConfig, holder: string): Promise<string> {
  if (!config.eurcSacId) throw new Error('EURC SAC not configured');
  return readSacBalance(config, config.eurcSacId, holder);
}

async function readSacBalance(config: DeploymentConfig, sacId: string, holder: string): Promise<string> {
  const s = server(config.rpcUrl);
  const contract = new Contract(sacId);
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('balance', nativeToScVal(holder, { type: 'address' })))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const val = sim.result?.retval;
  if (!val) throw new Error('No SAC balance returned');
  const raw = BigInt(String(scValToNative(val)));
  const whole = raw / 10_000_000n;
  const frac = (raw % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export async function buildUsdcTransferTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amount: string,
  proof: ProofBundle,
): Promise<string> {
  if (!config.complianceSacAdminId) {
    throw new Error(
      'USDC compliance admin not deployed. Set VITE_COMPLIANCE_SAC_ADMIN_ID after deploying compliance_sac_admin.',
    );
  }
  const recipient = to.trim();
  if (!validateStellarAddress(recipient)) {
    throw new Error('Recipient must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);
  const amountRaw = BigInt(Math.round(Number(amount) * 1e7));
  const s = server(config.rpcUrl);
  const acct = await s.getAccount(source);
  const contract = new Contract(config.complianceSacAdminId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'transfer_compliant',
        nativeToScVal(from, { type: 'address' }),
        nativeToScVal(recipient, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'USDC transfer simulation failed');
  }
  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

export async function buildEurcTransferTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amount: string,
  proof: ProofBundle,
): Promise<string> {
  if (!config.complianceSacAdminId) {
    throw new Error('ComplianceSacAdmin not deployed');
  }
  if (!config.eurcSacId) {
    throw new Error('EURC SAC not configured. Set VITE_EURC_SAC_ID.');
  }
  const recipient = to.trim();
  if (!validateStellarAddress(recipient)) {
    throw new Error('Recipient must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);
  const amountRaw = BigInt(Math.round(Number(amount) * 1e7));
  const s = server(config.rpcUrl);
  const acct = await s.getAccount(source);
  const contract = new Contract(config.complianceSacAdminId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'transfer_compliant_eurc',
        nativeToScVal(from, { type: 'address' }),
        nativeToScVal(recipient, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'EURC transfer simulation failed');
  }
  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

export async function buildSwapCompliantTransaction(
  config: DeploymentConfig,
  source: string,
  trader: string,
  recipient: string,
  amount: string,
  proof: ProofBundle,
): Promise<string> {
  if (!config.compliantDexId) {
    throw new Error('CompliantDEX not deployed. Set VITE_COMPLIANT_DEX_ID.');
  }
  const to = recipient.trim();
  if (!validateStellarAddress(to)) {
    throw new Error('Recipient must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);
  const amountRaw = BigInt(Math.round(Number(amount) * 1e7));
  const s = server(config.rpcUrl);
  const acct = await s.getAccount(source);
  const contract = new Contract(config.compliantDexId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'swap_compliant',
        nativeToScVal(trader, { type: 'address' }),
        nativeToScVal(to, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'CompliantDEX swap simulation failed');
  }
  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

export async function buildPayCompliantTransaction(
  config: DeploymentConfig,
  source: string,
  payer: string,
  employee: string,
  amount: string,
  proof: ProofBundle,
): Promise<string> {
  if (!config.compliantPayrollId) {
    throw new Error('CompliantPayroll not deployed. Set VITE_COMPLIANT_PAYROLL_ID.');
  }
  const to = employee.trim();
  if (!validateStellarAddress(to)) {
    throw new Error('Employee must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);
  const amountRaw = BigInt(Math.round(Number(amount) * 1e7));
  const s = server(config.rpcUrl);
  const acct = await s.getAccount(source);
  const contract = new Contract(config.compliantPayrollId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'pay_compliant',
        nativeToScVal(payer, { type: 'address' }),
        nativeToScVal(to, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'CompliantPayroll payout simulation failed');
  }
  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

export async function buildTransferTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amount: string,
  proof: ProofBundle,
): Promise<string> {
  const recipient = to.trim();
  if (!validateStellarAddress(recipient)) {
    throw new Error('Recipient must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);

  const s = server(config.rpcUrl);
  const acct = await s.getAccount(source);
  const contract = new Contract(config.rwaTokenId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'transfer',
        nativeToScVal(from, { type: 'address' }),
        nativeToScVal(recipient, { type: 'address' }),
        nativeToScVal(BigInt(amount), { type: 'i128' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();

  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Transfer simulation failed');
  }

  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

export async function buildVerifyTransaction(
  config: DeploymentConfig,
  source: string,
  policyId: number,
  proof: ProofBundle,
): Promise<string> {
  assertProofBundleForChain(proof);
  const s = server(config.rpcUrl);
  const acct = await s.getAccount(source);
  const contract = new Contract(config.policyVerifierId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'verify',
        nativeToScVal(policyId, { type: 'u32' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Verify simulation failed');
  }
  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

export async function buildAdapterVerifyTransaction(
  config: DeploymentConfig,
  source: string,
  policyId: number,
  proof: ProofBundle,
): Promise<string> {
  assertProofBundleForChain(proof);
  const s = server(config.rpcUrl);
  const acct = await s.getAccount(source);
  const contract = new Contract(config.rwaAdapterId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'verify_passport',
        nativeToScVal(policyId, { type: 'u32' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Adapter verify simulation failed');
  }
  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

export async function simulateAdapterEligible(
  config: DeploymentConfig,
  policyId: number,
  proof: ProofBundle,
): Promise<boolean> {
  const s = server(config.rpcUrl);
  const contract = new Contract(config.rwaAdapterId);
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'is_eligible',
        nativeToScVal(policyId, { type: 'u32' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return false;
  const val = sim.result?.retval;
  if (!val) return false;
  return Boolean(scValToNative(val));
}

export async function submitSignedTransaction(config: DeploymentConfig, signedXdr: string): Promise<string> {
  const s = server(config.rpcUrl);
  const tx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const result = await s.sendTransaction(tx);

  if (result.status === 'ERROR') {
    const malformed =
      typeof result.errorResult === 'object' &&
      result.errorResult !== null &&
      'result' in result.errorResult &&
      (result.errorResult as { result?: { _switch?: { name?: string } } }).result?._switch?.name ===
        'txMalformed';
    if (malformed) {
      throw new Error(
        'Transaction was rejected as malformed. Ensure Soroban simulation ran before signing (refresh and retry).',
      );
    }
    throw new Error(formatSubmitError(result));
  }

  const hash = result.hash;
  if (result.status === 'PENDING' || result.status === 'DUPLICATE' || result.status === 'TRY_AGAIN_LATER') {
    await waitForTransactionStatus(config.rpcUrl, hash);
  }
  return hash;
}

/** Poll Soroban RPC without parsing XDR (Protocol 25 meta v4 breaks stellar-sdk parsers). */
async function waitForTransactionStatus(
  rpcUrl: string,
  hash: string,
  attempts = 30,
  intervalMs = 2000,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    const status = await fetchTransactionStatus(rpcUrl, hash);
    if (status === 'SUCCESS') return;
    if (status === 'FAILED') throw new Error('Transaction failed on-chain');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function fetchTransactionStatus(rpcUrl: string, hash: string): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `lumengate-${Date.now()}`,
      method: 'getTransaction',
      params: { hash },
    }),
  });
  if (!res.ok) return 'NOT_FOUND';
  const json = (await res.json()) as { result?: { status?: string } };
  return json.result?.status ?? 'NOT_FOUND';
}

function formatSubmitError(result: rpc.Api.SendTransactionResponse): string {
  try {
    return JSON.stringify(result);
  } catch {
    return 'Transaction submission failed';
  }
}

export function validateStellarAddress(addr: string): boolean {
  return StrKey.isValidEd25519PublicKey(addr);
}

export function nullifierHexFromBundle(proof: ProofBundle): string {
  return `0x${BigInt(proof.publicInputs.nullifier).toString(16).padStart(64, '0')}`;
}

/** Map common Soroban contract traps to actionable messages. */
export function formatSorobanUserError(message: string): string {
  if (message.includes('Error(Contract, #7)')) {
    return (
      'This proof was already used on-chain (nullifier spent). ' +
      'Go to Credential → request a new credential, then Prove → generate a fresh proof before transferring again.'
    );
  }
  if (
    message.includes('Error(Contract, #13)') &&
    message.toLowerCase().includes('trustline')
  ) {
    return (
      'Recipient cannot receive USDC — they have no trustline for the official testnet USDC issuer. ' +
      'Use the treasury settlement address (pre-filled on USDC transfers) or ask the recipient to add USDC in their wallet first.'
    );
  }
  return message;
}

export function fieldToBytes32Hex(fieldDecimal: string): string {
  const hex = BigInt(fieldDecimal).toString(16).padStart(64, '0');
  return hex;
}

export function buildPublicInputsHex(fields: {
  root: string;
  revocationRoot: string;
  policyId: string;
  nullifier: string;
}): string {
  const parts = [
    fieldToBytes32Hex(fields.root),
    fieldToBytes32Hex(fields.revocationRoot),
    fieldToBytes32Hex(fields.policyId),
    fieldToBytes32Hex(fields.nullifier),
  ];
  return parts.join('');
}

export function extractPublicInputFields(publicInputsHex: string): ProofBundle['publicInputs'] {
  const h = publicInputsHex.replace(/^0x/, '');
  if (h.length < 256) {
    throw new Error(`Invalid public inputs length: expected 256 hex chars, got ${h.length}`);
  }
  const slice = (i: number) => {
    const chunk = h.slice(i * 64, (i + 1) * 64);
    if (!chunk) throw new Error(`Missing public input field at index ${i}`);
    return BigInt(`0x${chunk}`).toString(10);
  };
  return {
    root: slice(0),
    revocationRoot: slice(1),
    policyId: slice(2),
    nullifier: slice(3),
  };
}

export function hexFieldToDecimal(hexField: string): string {
  const normalized = hexField.startsWith('0x') ? hexField : `0x${hexField}`;
  return BigInt(normalized).toString(10);
}

/** Map UltraHonk proof output (bb.js 0.87 returns publicInputs as hex string[]). */
export function bundleFromHonkProof(
  proof: Uint8Array,
  publicInputs: string[] | Uint8Array,
): ProofBundle {
  const proofHex = Buffer.from(proof).toString('hex');

  if (Array.isArray(publicInputs)) {
    if (publicInputs.length < 4) {
      throw new Error(`Expected 4 public inputs from prover, got ${publicInputs.length}`);
    }
    const fields = {
      root: hexFieldToDecimal(publicInputs[0]),
      revocationRoot: hexFieldToDecimal(publicInputs[1]),
      policyId: hexFieldToDecimal(publicInputs[2]),
      nullifier: hexFieldToDecimal(publicInputs[3]),
    };
    return {
      proofHex,
      publicInputsHex: buildPublicInputsHex(fields),
      publicInputs: fields,
    };
  }

  const publicInputsHex = Buffer.from(publicInputs).toString('hex');
  return {
    proofHex,
    publicInputsHex,
    publicInputs: extractPublicInputFields(publicInputsHex),
  };
}
