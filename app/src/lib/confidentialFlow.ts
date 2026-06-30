import type { DeploymentConfig } from './config';
import type { SmartAccountAssembledTransaction } from './smartAccount';
import { initNoirRuntime } from './prover';
import { SyncUltraHonkBackend } from './syncUltraHonkBackend';
import { parseStellarAmount } from './assetAmount';
import { ChainClient } from './confidentialToken/chain/client';
import { addressToField } from './confidentialToken/crypto/address';
import {
  deserializeKeys,
  generateKeys,
  serializeKeys,
  type KeyPair,
  type SerializedKeyPair,
} from './confidentialToken/crypto/keys';
import { buildRegisterWitness } from './confidentialToken/witness/register';
import { buildTransferWitness } from './confidentialToken/witness/transfer';
import { LocalStorageStore } from './confidentialToken/state/browser-store';
import { StateEngine } from './confidentialToken/state/engine';
import {
  buildCtConfidentialTransferTransaction,
  buildCtDepositTransaction,
  buildCtMergeTransaction,
  buildCtRegisterTransaction,
  readCtRegistered,
} from './confidentialSettlement';

type CtCircuit = 'register' | 'transfer';

type CtProver = {
  noir: import('@noir-lang/noir_js').Noir;
  backend: SyncUltraHonkBackend;
};

const ctProvers = new Map<CtCircuit, Promise<CtProver>>();

function requireCtConfig(config: DeploymentConfig) {
  if (
    !config.confidentialTokenId ||
    !config.confidentialVerifierId ||
    !config.confidentialAuditorId
  ) {
    throw new Error('Confidential token contracts are not configured for this deployment.');
  }
  return {
    token: config.confidentialTokenId,
    verifier: config.confidentialVerifierId,
    auditor: config.confidentialAuditorId,
  };
}

function ctChainClient(config: DeploymentConfig): ChainClient {
  const contracts = requireCtConfig(config);
  return new ChainClient({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    contracts,
  });
}

function ctKeysStorageKey(smartAccount: string, tokenId: string): string {
  return `lumengate:ct:keys:${smartAccount}:${tokenId}`;
}

export function loadCtKeys(smartAccount: string, tokenId: string): KeyPair | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(ctKeysStorageKey(smartAccount, tokenId));
  if (!raw) return null;
  try {
    return deserializeKeys(JSON.parse(raw) as SerializedKeyPair);
  } catch {
    return null;
  }
}

export function saveCtKeys(smartAccount: string, tokenId: string, keys: KeyPair): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ctKeysStorageKey(smartAccount, tokenId), JSON.stringify(serializeKeys(keys)));
}

export function getOrCreateCtKeys(config: DeploymentConfig, smartAccount: string): KeyPair {
  const tokenId = requireCtConfig(config).token;
  const addrF = addressToField(tokenId);
  const existing = loadCtKeys(smartAccount, tokenId);
  if (existing) {
    if (existing.addrF !== addrF) {
      const keys = generateKeys(addrF);
      saveCtKeys(smartAccount, tokenId, keys);
      return keys;
    }
    return existing;
  }
  const keys = generateKeys(addrF);
  saveCtKeys(smartAccount, tokenId, keys);
  return keys;
}

async function ensureCtProver(circuit: CtCircuit): Promise<CtProver> {
  const pending = ctProvers.get(circuit);
  if (pending) return pending;
  const init = (async () => {
    await initNoirRuntime();
    const { Noir } = await import('@noir-lang/noir_js');
    const res = await fetch(`/confidential-circuits/${circuit}.json`);
    if (!res.ok) {
      throw new Error(`Confidential ${circuit} circuit missing (${res.status})`);
    }
    const artifact = await res.json();
    const noir = new Noir(artifact);
    const backend = new SyncUltraHonkBackend(artifact.bytecode);
    return { noir, backend };
  })();
  ctProvers.set(circuit, init);
  return init;
}

async function proveCtCircuit(
  circuit: CtCircuit,
  inputs: Record<string, string | string[]>,
): Promise<Uint8Array> {
  const { noir, backend } = await ensureCtProver(circuit);
  const { witness } = await noir.execute(inputs);
  const { proof } = await backend.generateProof(witness, { keccak: true });
  return proof;
}

function ctStateStore(tokenId: string): LocalStorageStore {
  return new LocalStorageStore(`lumengate:ct:state:${tokenId}:`);
}

async function ctStateEngine(
  config: DeploymentConfig,
  smartAccount: string,
  keys: KeyPair,
): Promise<StateEngine> {
  const client = ctChainClient(config);
  const tokenId = requireCtConfig(config).token;
  const fromLedger = Math.max(
    0,
    config.confidentialDeployedAtLedger ?? (await client.latestLedger()) - 50_000,
  );
  return new StateEngine({
    client,
    store: ctStateStore(tokenId),
    keys,
    address: smartAccount,
    fromLedger,
  });
}

export type ConfidentialSettlementStep =
  | 'register'
  | 'deposit'
  | 'merge'
  | 'prove-transfer'
  | 'transfer';

export type ConfidentialSettlementProgress = {
  step: ConfidentialSettlementStep;
  message: string;
};

export type SubmitCtTx = (
  tx: SmartAccountAssembledTransaction,
  stepLabel: string,
) => Promise<string>;

export async function registerConfidentialEurcAccount(input: {
  config: DeploymentConfig;
  txSource: string;
  smartAccount: string;
  onProgress?: (message: string) => void;
  submitTx: SubmitCtTx;
}): Promise<string> {
  const { config, txSource, smartAccount, onProgress, submitTx } = input;
  if (await readCtRegistered(config, smartAccount)) {
    return '';
  }
  const keys = getOrCreateCtKeys(config, smartAccount);
  onProgress?.('Generating confidential registration proof…');
  const witness = buildRegisterWitness(keys);
  const proof = await proveCtCircuit('register', witness.inputs);
  onProgress?.('Registering confidential account on Stellar…');
  const registerTx = await buildCtRegisterTransaction(
    config,
    txSource,
    smartAccount,
    config.confidentialAuditorIdNum ?? 1,
    witness,
    proof,
  );
  return submitTx(registerTx, 'register');
}

export async function executeConfidentialEurcSettlement(input: {
  config: DeploymentConfig;
  txSource: string;
  smartAccount: string;
  recipient: string;
  amount: string;
  onProgress?: (progress: ConfidentialSettlementProgress) => void;
  submitTx: SubmitCtTx;
}): Promise<{ txHash: string; steps: string[] }> {
  const { config, txSource, smartAccount, recipient, amount, onProgress, submitTx } = input;
  const contracts = requireCtConfig(config);
  const amountRaw = parseStellarAmount(amount);
  if (amountRaw <= 0n) throw new Error('Enter a positive amount.');

  const client = ctChainClient(config);
  const keys = getOrCreateCtKeys(config, smartAccount);
  const engine = await ctStateEngine(config, smartAccount, keys);
  const hashes: string[] = [];

  const progress = (step: ConfidentialSettlementStep, message: string) => {
    onProgress?.({ step, message });
  };

  let registered = await readCtRegistered(config, smartAccount);
  if (!registered) {
    progress('register', 'Generating confidential registration proof…');
    const witness = buildRegisterWitness(keys);
    const proof = await proveCtCircuit('register', witness.inputs);
    progress('register', 'Registering confidential account on Stellar…');
    const registerTx = await buildCtRegisterTransaction(
      config,
      txSource,
      smartAccount,
      config.confidentialAuditorIdNum ?? 1,
      witness,
      proof,
    );
    hashes.push(await submitTx(registerTx, 'register'));
    registered = true;
  }

  const recipientRegistered = await readCtRegistered(config, recipient);
  if (!recipientRegistered) {
    throw new Error(
      `Recipient ${recipient} is not registered for confidential EURC. ` +
        'The recipient must open Lumengate, complete passport verification, and register their confidential account in Settings before receiving.',
    );
  }
  const recipientAccount = await client.confidentialBalance(recipient);
  if (!recipientAccount) {
    throw new Error('Recipient confidential account could not be read from Stellar.');
  }

  progress('register', 'Syncing confidential balance…');
  let state = await engine.sync();
  if (!state.registered && registered) {
    state.registered = true;
    await ctStateStore(contracts.token).save(state);
  }

  const totalConfidential = state.spendable.v + state.receiving.v;
  if (totalConfidential < amountRaw) {
    const depositRaw = amountRaw - totalConfidential;
    progress('deposit', `Shielding ${amount} EURC into confidential balance…`);
    const depositTx = await buildCtDepositTransaction(
      config,
      txSource,
      smartAccount,
      smartAccount,
      depositRaw,
    );
    hashes.push(await submitTx(depositTx, 'deposit'));
    state = await engine.sync();
  }

  if (state.receiving.v > 0n || state.receiving.r !== 0n) {
    progress('merge', 'Consolidating confidential balance…');
    const mergeTx = await buildCtMergeTransaction(config, txSource, smartAccount);
    hashes.push(await submitTx(mergeTx, 'merge'));
    state = await engine.sync();
  }

  if (state.spendable.v < amountRaw) {
    throw new Error(
      `Insufficient confidential EURC after shielding (have ${state.spendable.v}, need ${amountRaw}).`,
    );
  }

  const senderOnChain = await client.confidentialBalance(smartAccount);
  if (!senderOnChain) {
    throw new Error('Sender confidential account missing on chain after registration.');
  }

  const kAudR = await client.auditorKey(recipientAccount.auditorId);
  const kAudS = await client.auditorKey(senderOnChain.auditorId);

  progress('prove-transfer', 'Generating confidential transfer proof…');
  const witness = buildTransferWitness({
    keys,
    v: state.spendable.v,
    r: state.spendable.r,
    amount: amountRaw,
    pvkB: recipientAccount.viewingPublicKey,
    kAudR,
    kAudS,
  });
  const proof = await proveCtCircuit('transfer', witness.inputs);

  progress('transfer', 'Submitting confidential transfer…');
  const transferTx = await buildCtConfidentialTransferTransaction(
    config,
    txSource,
    smartAccount,
    recipient,
    witness,
    proof,
  );
  const txHash = await submitTx(transferTx, 'transfer');
  hashes.push(txHash);

  await engine.setSpendable(witness.next);

  return { txHash, steps: hashes };
}

export async function readConfidentialEurcRegistered(
  config: DeploymentConfig,
  account: string,
): Promise<boolean> {
  if (!config.confidentialTokenId) return false;
  return readCtRegistered(config, account);
}
