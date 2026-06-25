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
  type Transaction,
} from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';
import { formatStellarAmount, hasSufficientBalance, parseStellarAmount } from './assetAmount';
import { bytesToHex } from './utils';
import type { AssetScope } from './assetScope';
import type { SmartAccountAssembledTransaction } from './smartAccount';
import { resolvePasskeySimulationSource } from './smartAccount';

export type ProofBundle = {
  proofHex: string;
  publicInputsHex: string;
  publicInputs: {
    root: string;
    revocationRoot: string;
    policyId: string;
    assetId: string;
    actionId: string;
    nullifier: string;
  };
};

/** Must match `ultrahonk_soroban_verifier::PROOF_BYTES` (bb 0.87 UltraHonk). */
export const ULTRA_HONK_PROOF_BYTES = 14_592;
/** Six BN254 public inputs × 32 bytes: root, revocation root, policy, asset, action, nullifier. */
export const PUBLIC_INPUTS_BYTES = 192;

function server(rpcUrl: string) {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
}

function readOnlyLedgerAccount(): Account {
  return new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
}

export async function resolveComplianceUsdcSacId(config: DeploymentConfig): Promise<string> {
  if (!config.complianceSacAdminId) {
    return config.usdcSacId;
  }
  const s = server(config.rpcUrl);
  const admin = new Contract(config.complianceSacAdminId);
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(admin.call('sac_address'))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    return config.usdcSacId;
  }
  const val = sim.result?.retval;
  if (!val) return config.usdcSacId;
  return String(scValToNative(val));
}

function isSmartAccountAddress(address: string): boolean {
  return address.startsWith('C') && StrKey.isValidContract(address);
}

/** Passkey path: smart account must authorize compliance_policy.set_session_proof. */
export async function buildBindSessionProofTransaction(
  config: DeploymentConfig,
  source: string,
  smartAccount: string,
  proof: ProofBundle,
): Promise<SmartAccountAssembledTransaction> {
  if (!config.compliancePolicyId) {
    throw new Error('Compliance policy not configured');
  }
  if (!isSmartAccountAddress(smartAccount)) {
    throw new Error('Session proof bind requires a smart account address');
  }
  assertProofBundleForChain(proof);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
  const policy = new Contract(config.compliancePolicyId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      policy.call(
        'set_session_proof',
        nativeToScVal(smartAccount, { type: 'address' }),
        scBytesFromHex(proof.proofHex),
        scBytesFromHex(proof.publicInputsHex),
      ),
    )
    .setTimeout(120)
    .build();
  return simulateAssembledTx(s, draft);
}

async function simulateAssembledTx(
  s: rpc.Server,
  draft: Transaction,
): Promise<SmartAccountAssembledTransaction> {
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Transaction simulation failed');
  }
  return { built: draft, simulationData: sim };
}

async function passkeySimulationAccount(config: DeploymentConfig, source: string) {
  const s = server(config.rpcUrl);
  return s.getAccount(resolvePasskeySimulationSource(source));
}

export async function readContractXlmBalance(config: DeploymentConfig, contractId: string): Promise<string> {
  const sacId = config.nativeSacId;
  if (!sacId) return '0';
  try {
    return await readSacBalance(config, sacId, contractId);
  } catch {
    return '0';
  }
}

export async function readOnChainRoots(config: DeploymentConfig): Promise<{ root: string; revocationRoot: string; noteRoot: string }> {
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
  const tuple = scValToNative(val) as [Buffer | Uint8Array, Buffer | Uint8Array, Buffer | Uint8Array | undefined];
  return {
    root: `0x${bytesToHex(Uint8Array.from(tuple[0]))}`,
    revocationRoot: `0x${bytesToHex(Uint8Array.from(tuple[1]))}`,
    noteRoot: `0x${bytesToHex(Uint8Array.from(tuple[2] ?? new Uint8Array(32)))}`,
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
  scope?: Pick<AssetScope, 'assetId' | 'actionId'>,
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
        scope ? 'is_scoped_nullifier_spent' : 'is_nullifier_spent',
        nativeToScVal(pid, { type: 'u32' }),
        ...(scope
          ? [
              nativeToScVal(Number(scope.assetId), { type: 'u32' }),
              nativeToScVal(Number(scope.actionId), { type: 'u32' }),
            ]
          : []),
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

export async function assertPassportNullifierAvailable(
  config: DeploymentConfig,
  proof: ProofBundle,
): Promise<void> {
  const policyId = Number(proof.publicInputs.policyId || config.policyId);
  const spent = await readNullifierSpent(config, nullifierHexFromBundle(proof), policyId, {
    assetId: proof.publicInputs.assetId,
    actionId: proof.publicInputs.actionId,
  });
  if (spent) {
    throw new Error('Error(Contract, #6) NullifierSpent');
  }
}

export function assertProofScope(proof: ProofBundle, scope: AssetScope): void {
  if (
    proof.publicInputs.assetId !== scope.assetId ||
    proof.publicInputs.actionId !== scope.actionId
  ) {
    throw new Error(
      `Eligibility proof is scoped to asset ${proof.publicInputs.assetId}/action ${proof.publicInputs.actionId}; ` +
        `expected asset ${scope.assetId}/action ${scope.actionId}. Regenerate proof for this settlement.`,
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

async function readSacBalanceRaw(
  config: DeploymentConfig,
  sacId: string,
  holder: string,
): Promise<bigint> {
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
  return BigInt(String(scValToNative(val)));
}

async function readSacBalance(config: DeploymentConfig, sacId: string, holder: string): Promise<string> {
  const raw = await readSacBalanceRaw(config, sacId, holder);
  return formatStellarAmount(raw);
}

/** Balance on the exact USDC SAC wired into ComplianceSacAdmin (settlement source of truth). */
export async function readComplianceAdminUsdcBalance(
  config: DeploymentConfig,
  holder: string,
): Promise<{ formatted: string; raw: bigint; sacId: string }> {
  if (!config.complianceSacAdminId) {
    throw new Error('ComplianceSacAdmin not configured');
  }
  const s = server(config.rpcUrl);
  const admin = new Contract(config.complianceSacAdminId);
  const sacTx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(admin.call('sac_address'))
    .setTimeout(30)
    .build();
  const sacSim = await s.simulateTransaction(sacTx);
  if (rpc.Api.isSimulationError(sacSim)) throw new Error(sacSim.error);
  const sacVal = sacSim.result?.retval;
  if (!sacVal) throw new Error('ComplianceSacAdmin sac_address unavailable');
  const sacId = String(scValToNative(sacVal));
  const raw = await readSacBalanceRaw(config, sacId, holder);
  return { formatted: formatStellarAmount(raw), raw, sacId };
}

export async function assertSufficientSacBalance(
  config: DeploymentConfig,
  holder: string,
  amount: string,
  assetLabel: string,
  sacId?: string,
): Promise<void> {
  const amountRaw = parseStellarAmount(amount);
  let balanceRaw: bigint;
  if (sacId) {
    balanceRaw = await readSacBalanceRaw(config, sacId, holder);
  } else {
    const snap = await readComplianceAdminUsdcBalance(config, holder);
    balanceRaw = snap.raw;
  }
  if (!hasSufficientBalance(balanceRaw, amountRaw)) {
    throw new Error(
      `Insufficient ${assetLabel} for this transfer. Available: ${formatStellarAmount(balanceRaw)} ${assetLabel}. ` +
        'Compliant settlement uses your Soroban token balance — try a smaller amount or use Treasury units instead.',
    );
  }
}

export async function buildUsdcTransferTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amount: string,
  proof: ProofBundle,
  scope: AssetScope,
): Promise<SmartAccountAssembledTransaction> {
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
  assertProofScope(proof, scope);
  await assertPassportNullifierAvailable(config, proof);
  const amountRaw = parseStellarAmount(amount);
  await assertSufficientSacBalance(config, from, amount, 'USDC');
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
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
  return simulateAssembledTx(s, draft);
}

export async function buildEurcTransferTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amount: string,
  proof: ProofBundle,
  scope: AssetScope,
): Promise<SmartAccountAssembledTransaction> {
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
  assertProofScope(proof, scope);
  await assertPassportNullifierAvailable(config, proof);
  const amountRaw = parseStellarAmount(amount);
  if (!config.eurcSacId) throw new Error('EURC SAC not configured');
  await assertSufficientSacBalance(config, from, amount, 'EURC', config.eurcSacId);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
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
  return simulateAssembledTx(s, draft);
}

export async function buildSwapCompliantTransaction(
  config: DeploymentConfig,
  source: string,
  trader: string,
  recipient: string,
  amount: string,
  proof: ProofBundle,
): Promise<SmartAccountAssembledTransaction> {
  if (!config.compliantDexId) {
    throw new Error('CompliantDEX not deployed. Set VITE_COMPLIANT_DEX_ID.');
  }
  const to = recipient.trim();
  if (!validateStellarAddress(to)) {
    throw new Error('Recipient must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);
  await assertPassportNullifierAvailable(config, proof);
  const amountRaw = parseStellarAmount(amount);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
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
  return simulateAssembledTx(s, draft);
}

export async function buildPayCompliantTransaction(
  config: DeploymentConfig,
  source: string,
  payer: string,
  employee: string,
  amount: string,
  proof: ProofBundle,
): Promise<SmartAccountAssembledTransaction> {
  if (!config.compliantPayrollId) {
    throw new Error('CompliantPayroll not deployed. Set VITE_COMPLIANT_PAYROLL_ID.');
  }
  const to = employee.trim();
  if (!validateStellarAddress(to)) {
    throw new Error('Employee must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);
  await assertPassportNullifierAvailable(config, proof);
  const amountRaw = parseStellarAmount(amount);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
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
  return simulateAssembledTx(s, draft);
}

export async function buildTransferTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amount: string,
  proof: ProofBundle,
  scope: AssetScope,
): Promise<SmartAccountAssembledTransaction> {
  const recipient = to.trim();
  if (!validateStellarAddress(recipient)) {
    throw new Error('Recipient must be a valid Stellar G-address');
  }
  assertProofBundleForChain(proof);
  assertProofScope(proof, scope);
  await assertPassportNullifierAvailable(config, proof);

  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
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

  return simulateAssembledTx(s, draft);
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
  if (result.status === 'ERROR') {
    const malformed =
      typeof result.errorResult === 'object' &&
      result.errorResult !== null &&
      'result' in result.errorResult &&
      (result.errorResult as { result?: { _switch?: { name?: string } } }).result?._switch?.name ===
        'txMalformed';
    if (malformed) {
      return 'Transaction was rejected as malformed. Refresh the page and retry.';
    }
  }
  try {
    const raw = JSON.stringify(result);
    return formatSorobanUserError(raw);
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

/** Append hints to raw Soroban errors — never replace or hide simulation diagnostics. */
export function formatSorobanUserError(message: string): string {
  const hints: string[] = [];

  if (message.includes('Error(Contract, #3112)')) {
    hints.push('WebAuthn clientDataJSON could not be parsed (JsonParseError).');
  }
  if (message.includes('Error(Contract, #3114)')) {
    hints.push('WebAuthn challenge does not match auth_digest (ChallengeInvalid).');
  }
  if (message.includes('Error(Contract, #3117)')) {
    hints.push('Passkey user verification (UV) bit was not set (VerifiedBitNotSet).');
  }
  if (message.includes('Error(Contract, #3116)')) {
    hints.push('Passkey user presence (UP) bit was not set (PresentBitNotSet).');
  }
  if (message.includes('Error(Contract, #3002)') || message.includes('UnvalidatedContext')) {
    hints.push('Passkey context rule does not match this transaction (UnvalidatedContext).');
  }
  if (message.includes('Error(Contract, #3014)') || message.includes('ContextRuleIdsLengthMismatch')) {
    hints.push('context_rule_ids length does not match auth contexts (ContextRuleIdsLengthMismatch).');
  }
  if (message.includes('Error(Contract, #3016)') || message.includes('UnauthorizedSigner')) {
    hints.push('Signer is not authorized for the selected context rules (UnauthorizedSigner).');
  }
  if (message.includes('Error(Contract, #3003)') || message.includes('ExternalSignatureVerificationFailed')) {
    hints.push('External WebAuthn signature verification failed.');
  }
  if (message.includes('Error(Auth, InvalidAction)') || message.includes('__check_auth')) {
    hints.push('Smart account __check_auth rejected the authorization entry.');
  }

  if (message.includes('Error(Contract, #6)') || message.includes('NullifierSpent')) {
    hints.push('This passport nullifier was already spent on-chain.');
  }
  if (message.includes('Error(Contract, #7)')) {
    hints.push('Eligibility scope does not match the selected offering.');
  }
  if (message.includes('Error(Contract, #5)') && message.toLowerCase().includes('verify')) {
    hints.push('On-chain eligibility verification failed during verify_passport.');
  }
  if (message.includes('Error(Contract, #2)') && message.toLowerCase().includes('verification')) {
    hints.push('On-chain eligibility verification failed.');
  }
  if (
    message.includes('Error(Contract, #13)') &&
    message.toLowerCase().includes('trustline')
  ) {
    hints.push('Recipient has no trustline for the settlement asset.');
  }
  if (message.includes('Error(Object, InvalidInput)')) {
    hints.push('AuthPayload map ordering is invalid (Object InvalidInput).');
  }
  if (message.includes('Error(Contract, #1)') && message.toLowerCase().includes('notconfigured')) {
    hints.push('Session proof is not bound on the compliance policy used by this smart account.');
  }
  if (message.includes('Error(Contract, #2)') && message.toLowerCase().includes('verificationfailed')) {
    hints.push('Eligibility verification failed during authorization or settlement.');
  }
  if (message.includes('No signer found for credential ID')) {
    hints.push('Passkey signer metadata is missing for this credential on-chain.');
  }
  if (message.includes('Invalid contract ID') || message.includes('Unsupported address type')) {
    hints.push('A configured contract ID is invalid for this network.');
  }
  if (message.includes('txMalformed') || message.toLowerCase().includes('malformed')) {
    hints.push('Transaction envelope was rejected as malformed.');
  }
  if (
    message.includes('Error(Contract, #10)') ||
    message.toLowerCase().includes('balance is not within the allowed range')
  ) {
    hints.push('Insufficient Soroban token balance for this transfer amount.');
  }

  if (hints.length === 0) return message;
  return `${message}\n\n${hints.join('\n')}`;
}

export function fieldToBytes32Hex(fieldDecimal: string): string {
  const hex = BigInt(fieldDecimal).toString(16).padStart(64, '0');
  return hex;
}

export function buildPublicInputsHex(fields: {
  root: string;
  revocationRoot: string;
  policyId: string;
  assetId: string;
  actionId: string;
  nullifier: string;
}): string {
  const parts = [
    fieldToBytes32Hex(fields.root),
    fieldToBytes32Hex(fields.revocationRoot),
    fieldToBytes32Hex(fields.policyId),
    fieldToBytes32Hex(fields.assetId),
    fieldToBytes32Hex(fields.actionId),
    fieldToBytes32Hex(fields.nullifier),
  ];
  return parts.join('');
}

export function extractPublicInputFields(publicInputsHex: string): ProofBundle['publicInputs'] {
  const h = publicInputsHex.replace(/^0x/, '');
  if (h.length < 384) {
    throw new Error(`Invalid public inputs length: expected 384 hex chars, got ${h.length}`);
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
    assetId: slice(3),
    actionId: slice(4),
    nullifier: slice(5),
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
    if (publicInputs.length < 6) {
      throw new Error(`Expected 6 public inputs from prover, got ${publicInputs.length}`);
    }
    const fields = {
      root: hexFieldToDecimal(publicInputs[0]),
      revocationRoot: hexFieldToDecimal(publicInputs[1]),
      policyId: hexFieldToDecimal(publicInputs[2]),
      assetId: hexFieldToDecimal(publicInputs[3]),
      actionId: hexFieldToDecimal(publicInputs[4]),
      nullifier: hexFieldToDecimal(publicInputs[5]),
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
