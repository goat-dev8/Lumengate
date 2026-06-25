import { Address, hash, Keypair, Operation, rpc, Transaction, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import base64url from 'base64url';
import { Client as SmartAccountClient, type Signer as ContractSigner } from 'smart-account-kit-bindings';
import {
  IndexedDBStorage,
  SmartAccountKit,
  type CreateWalletResult,
  type TransactionResult,
} from 'smart-account-kit';
import type { DeploymentConfig } from './config';
import {
  contextRuleTypeKey,
  contextRuleTypeMatches,
  coerceKeyDataBuffer,
  externalSignerKeyDataEqual,
  fetchOnChainContextRules,
  findPasskeyKeyDataInRules,
  findPasskeySignerInContextRules,
  findPasskeySignerInRules,
  listOnChainContextRules,
  type OnChainContextRule,
} from './onChainContextRules';
import { patchPasskeyAuthPayloadV07, countAuthContextsInTree } from './passkeyAuthPayloadV07';
import { passkeyUserName } from './passkeyUserHandle';
import { extractRegistrationPublicKey } from './webauthnPublicKey';

export { passkeyUserName } from './passkeyUserHandle';

/** Fee payer + simulation source used by smart-account-kit (must exist on testnet). */
export const SMART_ACCOUNT_KIT_DEPLOYER_PUBLIC_KEY = Keypair.fromRawEd25519Seed(
  hash(Buffer.from('openzeppelin-smart-account-kit')),
).publicKey();

/** Build WebAuthn key_data bytes: 65-byte secp256r1 pubkey + credential id. */
export function buildPasskeyKeyData(publicKey: Buffer | Uint8Array, credentialId: Buffer | string): Buffer {
  if (!publicKey) {
    throw new Error('Passkey public key is missing.');
  }
  const credBuffer = typeof credentialId === 'string' ? base64url.toBuffer(credentialId) : credentialId;
  if (!credBuffer?.length) {
    throw new Error('Passkey credential ID is missing.');
  }
  return Buffer.concat([Buffer.from(publicKey), credBuffer]);
}

/** smart-account-kit re-simulates and submits from the kit deployer, not the Freighter wallet. */
export function resolvePasskeySimulationSource(_freighterAddress?: string | null): string {
  return SMART_ACCOUNT_KIT_DEPLOYER_PUBLIC_KEY;
}

/** Immutable policy contracts superseded by check_passport auth fix (commit 1f80276). */
export const LEGACY_COMPLIANCE_POLICY_IDS = [
  'CDONRLSIDIT7D5DN2PRQY6SR64FRBZ7MBJP5HCODFAP5M4JZ2USM6HS4',
] as const;

export type SmartAccountState = {
  smartAccountAddress: string;
  credentialId: string;
  /** Base64-encoded secp256r1 public key for passkey signing lookups. */
  passkeyPublicKey?: string;
  /** Exact on-chain External signer key_data (pubkey + credential id). */
  passkeyKeyDataHex?: string;
  createdAt: number;
  deploymentHash?: string;
  /** Compliance policy installed in this account's default context rule. */
  compliancePolicyId?: string;
  compliancePolicyInstalled?: boolean;
  compliancePolicyTxHash?: string;
};

/** True when the stored account was deployed with a superseded compliance policy. */
export function isStaleSmartAccountPolicy(
  state: SmartAccountState | null | undefined,
  config: DeploymentConfig,
): boolean {
  if (!state || !config.compliancePolicyId) return false;
  const installed = state.compliancePolicyId?.trim();
  if (!installed) return true;
  if (installed === config.compliancePolicyId) return false;
  return (
    LEGACY_COMPLIANCE_POLICY_IDS.includes(installed as (typeof LEGACY_COMPLIANCE_POLICY_IDS)[number]) ||
    installed !== config.compliancePolicyId
  );
}

export type SmartAccountStatus = {
  ready: boolean;
  missing: string[];
};

export type SmartAccountAssembledTransaction = {
  built?: unknown;
  simulationData?: { result?: { auth?: unknown[] } };
};

export type SignableTransaction = string | SmartAccountAssembledTransaction;

const storage = new IndexedDBStorage();

function clampRegistrationUserId(optionsJSON: { user?: { id?: string } }): void {
  const id = optionsJSON.user?.id;
  if (!id) return;
  const bytes = base64url.toBuffer(id);
  if (bytes.length <= 64) return;
  optionsJSON.user!.id = base64url(bytes.subarray(0, 64));
}

export function smartAccountStatus(config: DeploymentConfig): SmartAccountStatus {
  const missing: string[] = [];
  if (!config.lumengateSmartAccountWasmHash) missing.push('VITE_LUMENGATE_SMART_ACCOUNT_WASM_HASH');
  if (!config.webauthnVerifierId) missing.push('VITE_WEBAUTHN_VERIFIER_ID');
  if (!config.compliancePolicyId) missing.push('VITE_COMPLIANCE_POLICY_ID');
  if (!config.rwaAdapterId) missing.push('VITE_RWA_ADAPTER_ID');
  return { ready: missing.length === 0, missing };
}

export function createSmartAccountKit(config: DeploymentConfig): SmartAccountKit {
  const status = smartAccountStatus(config);
  if (!status.ready || !config.webauthnVerifierId || !config.lumengateSmartAccountWasmHash) {
    throw new Error(`Smart account config missing: ${status.missing.join(', ')}`);
  }
  return new SmartAccountKit({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    accountWasmHash: config.lumengateSmartAccountWasmHash,
    webauthnVerifierAddress: config.webauthnVerifierId,
    relayerUrl: config.openZeppelinRelayerUrl,
    storage,
    rpName: 'Lumengate',
    rpId:
      config.passkeyRpId ??
      (typeof window !== 'undefined' ? window.location.hostname : undefined),
    webAuthn: {
      startRegistration: async (options) => {
        clampRegistrationUserId(options.optionsJSON);
        const response = await startRegistration(options);
        const publicKey = extractRegistrationPublicKey(response.response);
        return {
          ...response,
          response: {
            ...response.response,
            publicKey: base64url(Buffer.from(publicKey)),
          },
        };
      },
      startAuthentication,
    },
  });
}

/** CompliancePolicyParams encoded for Soroban Val (add_policy / deploy policies map). */
function complianceInstallParamScVal(config: DeploymentConfig): xdr.ScVal {
  if (!config.rwaAdapterId) {
    throw new Error('RWA adapter is not configured.');
  }
  const entries = [
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('adapter'),
      val: Address.fromString(config.rwaAdapterId).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('policy_id'),
      val: xdr.ScVal.scvU32(config.policyId),
    }),
  ];
  entries.sort((a, b) => a.key().toXDR('hex').localeCompare(b.key().toXDR('hex')));
  return xdr.ScVal.scvMap(entries);
}

const SMART_ACCOUNT_DEPLOYER = Keypair.fromRawEd25519Seed(
  hash(Buffer.from('openzeppelin-smart-account-kit')),
);

async function readFailedTransactionDiagnostics(rpcUrl: string, txHash: string): Promise<string> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `lumengate-tx-${Date.now()}`,
        method: 'getTransaction',
        params: { hash: txHash },
      }),
    });
    if (!res.ok) return '';
    const json = (await res.json()) as {
      result?: { status?: string; resultXdr?: string; resultMetaXdr?: string };
    };
    if (json.result?.status !== 'FAILED') return '';
    const parts = [json.result.resultXdr, json.result.resultMetaXdr].filter(Boolean);
    return parts.join(' ');
  } catch {
    return '';
  }
}

type KitDeployInternals = {
  buildDeployTransaction: (
    credentialId: Buffer,
    publicKey: Buffer,
  ) => ReturnType<typeof SmartAccountClient.deploy>;
  accountWasmHash: string;
  webauthnVerifierAddress: string;
  networkPassphrase: string;
  rpcUrl: string;
  timeoutInSeconds: number;
};

type KitSubmitInternals = {
  rpc: rpc.Server;
  networkPassphrase: string;
  timeoutInSeconds: number;
  deployerKeypair?: Keypair;
  shouldUseFeeSponsoring: (options?: { forceMethod?: 'relayer' | 'rpc' }) => boolean;
  hasSourceAccountAuth: (transaction: Transaction) => boolean;
  sendAndPoll: (
    transaction: Transaction,
    options?: { forceMethod?: 'relayer' | 'rpc' },
  ) => Promise<TransactionResult>;
};

type ContextRuleType = OnChainContextRule['context_type'];

/** Install compliance policy in __constructor so deploy does not need a passkey-signed add_policy tx. */
function patchDeployWithCompliancePolicy(kit: SmartAccountKit, config: DeploymentConfig): void {
  if (!config.compliancePolicyId) return;
  const deployable = kit as unknown as KitDeployInternals;
  deployable.buildDeployTransaction = async (credentialId, publicKey) => {
    const keyData = buildPasskeyKeyData(publicKey, credentialId);
    const policies = new Map<string, xdr.ScVal>();
    policies.set(config.compliancePolicyId!, complianceInstallParamScVal(config));
    return SmartAccountClient.deploy(
      {
        signers: [
          {
            tag: 'External',
            values: [deployable.webauthnVerifierAddress, keyData],
          },
        ],
        policies,
      },
      {
        networkPassphrase: deployable.networkPassphrase,
        rpcUrl: deployable.rpcUrl,
        wasmHash: deployable.accountWasmHash,
        publicKey: SMART_ACCOUNT_DEPLOYER.publicKey(),
        salt: hash(credentialId),
        timeoutInSeconds: deployable.timeoutInSeconds,
      },
    );
  };
}

/** Fill missing passkey metadata from on-chain context rule signers. */
export async function hydrateSmartAccountPasskeyMetadata(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<SmartAccountState> {
  if (state.passkeyKeyDataHex && state.passkeyPublicKey) {
    if (!config.webauthnVerifierId) return state;
    const rules = await listOnChainContextRules(config, state.smartAccountAddress, {
      maxRuleId: 4,
      maxConsecutiveMisses: 2,
    });
    const fromChain = findPasskeyKeyDataInRules(rules, config.webauthnVerifierId, state.credentialId);
    if (fromChain) {
      const hex = fromChain.toString('hex');
      if (hex === state.passkeyKeyDataHex) return state;
      return {
        ...state,
        passkeyKeyDataHex: hex,
        passkeyPublicKey: fromChain.subarray(0, 65).toString('base64'),
      };
    }
    return state;
  }
  if (!config.webauthnVerifierId) return state;

  const rules = await listOnChainContextRules(config, state.smartAccountAddress, {
    maxRuleId: 4,
    maxConsecutiveMisses: 2,
  });
  const signer = findPasskeySignerInRules(rules, config.webauthnVerifierId, state.credentialId);
  if (!signer) return state;

  const keyData = coerceKeyDataBuffer(signer.values[1]);
  if (!keyData) return state;
  return {
    ...state,
    passkeyKeyDataHex: keyData.toString('hex'),
    passkeyPublicKey: keyData.subarray(0, 65).toString('base64'),
  };
}

/** Resolve passkey key_data: stored deploy bytes, else on-chain, else recomputed from metadata. */
export function resolvePasskeyKeyData(
  state: SmartAccountState,
  rules?: OnChainContextRule[],
  webauthnVerifierId?: string,
): Buffer {
  if (state.passkeyKeyDataHex) {
    const stored = coerceKeyDataBuffer(state.passkeyKeyDataHex);
    if (stored) return stored;
  }

  if (rules && webauthnVerifierId) {
    const fromChain = findPasskeyKeyDataInRules(rules, webauthnVerifierId, state.credentialId);
    if (fromChain) return fromChain;
  }

  if (state.passkeyPublicKey) {
    return buildPasskeyKeyData(Buffer.from(state.passkeyPublicKey, 'base64'), state.credentialId);
  }

  throw new Error(
    'Passkey metadata missing for this smart account. Create a new passkey smart account, then retry.',
  );
}

async function ensurePasskeyCredentialInKitStorage(
  kit: SmartAccountKit,
  config: DeploymentConfig,
  state: SmartAccountState,
  rules: OnChainContextRule[],
): Promise<void> {
  const kitStorage = (kit as unknown as { storage: SmartAccountKit['storage'] }).storage;
  const existing = await kitStorage.get(state.credentialId);
  if (existing?.publicKey?.length) return;
  if (!config.webauthnVerifierId) return;

  const keyData = resolvePasskeyKeyData(state, rules, config.webauthnVerifierId);
  await kitStorage.save({
    credentialId: state.credentialId,
    publicKey: keyData.subarray(0, 65),
    contractId: state.smartAccountAddress,
    nickname: 'Lumengate',
    createdAt: state.createdAt || Date.now(),
    isPrimary: true,
    deploymentStatus: 'deployed',
  });
}

/** Use on-chain context rules (fallback to stored key_data) for signer lookup during auth. */
function patchWalletContextRulesLookup(
  kit: SmartAccountKit,
  config: DeploymentConfig,
  state: SmartAccountState,
): void {
  const wallet = kit.wallet as { get_context_rules?: (...args: unknown[]) => Promise<{ result: unknown[] }> } | undefined;
  if (!wallet?.get_context_rules || !config.webauthnVerifierId) return;

  const resolveKeyData = async (): Promise<Buffer> => {
    const kitAny = kit as unknown as { _passkeyKeyData?: Buffer };
    if (kitAny._passkeyKeyData) return kitAny._passkeyKeyData;
    const rules = await listOnChainContextRules(config, state.smartAccountAddress, {
      maxRuleId: 4,
      maxConsecutiveMisses: 2,
    });
    const keyData = resolvePasskeyKeyData(state, rules, config.webauthnVerifierId);
    kitAny._passkeyKeyData = keyData;
    return keyData;
  };

  void resolveKeyData().catch(() => {
    // Hydration may still be in flight; signAuthEntry resolves key_data at signing time.
  });

  (wallet as { get_context_rules: (args: { context_rule_type: { tag: string; values?: unknown[] } }) => Promise<{ result: unknown[] }> })
    .get_context_rules = async ({ context_rule_type }) => {
    const onChain = await fetchOnChainContextRules(
      config,
      state.smartAccountAddress,
      context_rule_type,
    );
    if (onChain.length > 0) {
      return {
        result: onChain.map((rule) => ({
          id: rule.id,
          context_type: rule.context_type,
          name: rule.name,
          policies: rule.policies,
          signers: rule.signers,
          valid_until: rule.valid_until,
        })),
      };
    }

    const keyData = await resolveKeyData();
    return {
      result: [{
        id: 0,
        context_type: { tag: 'Default' as const },
        name: 'default',
        policies: config.compliancePolicyId ? [config.compliancePolicyId] : [],
        signers: [
          {
            tag: 'External' as const,
            values: [config.webauthnVerifierId!, keyData],
          },
        ],
        valid_until: undefined,
      }],
    };
  };
}

async function submitResultOrThrow(
  result: TransactionResult,
  fallback: string,
  rpcUrl?: string,
): Promise<string> {
  if (!result.success || !result.hash) {
    const detail =
      result.hash && rpcUrl ? await readFailedTransactionDiagnostics(rpcUrl, result.hash) : '';
    throw new Error([result.error || fallback, detail].filter(Boolean).join(' — '));
  }
  return result.hash;
}

export async function createPersonalSmartAccount(
  config: DeploymentConfig,
  walletAddress: string,
): Promise<SmartAccountState> {
  if (!config.compliancePolicyId) {
    throw new Error('Smart account compliance policy is not configured.');
  }
  const kit = createSmartAccountKit(config);
  patchDeployWithCompliancePolicy(kit, config);
  const created: CreateWalletResult & { submitResult?: TransactionResult } = await kit.createWallet(
    'Lumengate',
    passkeyUserName(walletAddress),
    {
      autoSubmit: true,
      forceMethod: config.openZeppelinRelayerUrl ? 'relayer' : 'rpc',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
    },
  );
  const deploymentHash = created.submitResult
    ? await submitResultOrThrow(created.submitResult, 'Smart account deployment failed', config.rpcUrl)
    : undefined;

  const passkeyKeyData = buildPasskeyKeyData(created.publicKey, created.credentialId);
  const createdState: SmartAccountState = {
    smartAccountAddress: created.contractId,
    credentialId: created.credentialId,
    passkeyPublicKey: Buffer.from(created.publicKey).toString('base64'),
    passkeyKeyDataHex: passkeyKeyData.toString('hex'),
    createdAt: Date.now(),
  };
  patchWalletContextRulesLookup(kit, config, createdState);
  patchPasskeyAuthPayloadV07(kit);

  return {
    ...createdState,
    createdAt: Date.now(),
    deploymentHash,
    compliancePolicyId: config.compliancePolicyId,
    compliancePolicyInstalled: true,
    compliancePolicyTxHash: deploymentHash,
  };
}

export async function connectPersonalSmartAccount(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<SmartAccountKit> {
  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  const rules = await listOnChainContextRules(config, hydrated.smartAccountAddress, {
    maxRuleId: 4,
    maxConsecutiveMisses: 2,
  });
  const kit = createSmartAccountKit(config);
  await kit.connectWallet({
    contractId: hydrated.smartAccountAddress,
    credentialId: hydrated.credentialId,
  });
  await ensurePasskeyCredentialInKitStorage(kit, config, hydrated, rules).catch(() => undefined);
  patchWalletContextRulesLookup(kit, config, hydrated);
  patchPasskeyAuthPayloadV07(kit);
  const keyData = resolvePasskeyKeyData(hydrated, rules, config.webauthnVerifierId ?? undefined);
  (kit as unknown as { _passkeyKeyData?: Buffer })._passkeyKeyData = keyData;
  return kit;
}

function extractCreateContractWasmHash(fn: xdr.SorobanAuthorizedFunction): Buffer | null {
  const candidates: Array<unknown> = [];
  const fnAny = fn as unknown as {
    createContractHostFn?: () => unknown;
    createContractWithCtorHostFn?: () => unknown;
    createContractWithConstructorHostFn?: () => unknown;
  };
  if (typeof fnAny.createContractHostFn === 'function') candidates.push(fnAny.createContractHostFn());
  if (typeof fnAny.createContractWithCtorHostFn === 'function') candidates.push(fnAny.createContractWithCtorHostFn());
  if (typeof fnAny.createContractWithConstructorHostFn === 'function') {
    candidates.push(fnAny.createContractWithConstructorHostFn());
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const ctx = candidate as { executable?: unknown };
    const executable = typeof ctx.executable === 'function'
      ? (ctx.executable as () => unknown)()
      : ctx.executable;
    if (!executable || typeof executable !== 'object') continue;
    const execAny = executable as {
      switch?: () => { name: string };
      wasm?: (() => Buffer) | Buffer;
    };
    if (execAny.switch?.().name === 'contractExecutableWasm') {
      const wasm = typeof execAny.wasm === 'function' ? execAny.wasm() : execAny.wasm;
      if (wasm) return Buffer.from(wasm);
    }
  }
  return null;
}

/** One auth context per invocation-tree node (matches soroban-env-host auth_contexts length). */
function buildAuthContextTypesFromTree(entry: xdr.SorobanAuthorizationEntry): ContextRuleType[] {
  const contexts: ContextRuleType[] = [];
  const walk = (invocation: xdr.SorobanAuthorizedInvocation) => {
    const fn = invocation.function();
    const switchName = fn.switch().name;
    if (switchName === 'sorobanAuthorizedFunctionTypeContractFn') {
      const args = fn.contractFn();
      contexts.push({
        tag: 'CallContract',
        values: [Address.fromScAddress(args.contractAddress()).toString()],
      });
    } else if (switchName.startsWith('sorobanAuthorizedFunctionTypeCreateContract')) {
      const wasmHash = extractCreateContractWasmHash(fn);
      if (!wasmHash) {
        throw new Error('Unable to extract WASM hash from create-contract authorization entry');
      }
      contexts.push({ tag: 'CreateContract', values: [wasmHash] });
    } else {
      contexts.push({ tag: 'Default' });
    }
    for (const sub of invocation.subInvocations()) {
      walk(sub);
    }
  };
  walk(entry.rootInvocation());
  return contexts;
}

function resolveContextRuleIdForContext(
  rules: OnChainContextRule[],
  contextType: ContextRuleType,
  candidateSigner: ContractSigner,
): number {
  const candidates = rules.filter((rule) => contextRuleTypeMatches(rule.context_type, contextType));
  if (candidates.length === 1) return candidates[0].id;

  const exactSignerMatches = candidates.filter((rule) => (
    rule.signers.length === 1 && rule.signers.some((ruleSigner) => contractSignersEqual(ruleSigner, candidateSigner))
  ));
  if (exactSignerMatches.length === 1) return exactSignerMatches[0].id;

  const signerSubsetMatches = candidates.filter((rule) => (
    rule.policies.length === 0 &&
    rule.signers.every((ruleSigner) => contractSignersEqual(ruleSigner, candidateSigner))
  ));
  if (signerSubsetMatches.length === 1) return signerSubsetMatches[0].id;

  const defaultRules = rules.filter((rule) => rule.context_type.tag === 'Default');
  if (defaultRules.length === 1) return defaultRules[0].id;
  const ruleZero = rules.find((rule) => rule.id === 0);
  if (ruleZero) return ruleZero.id;

  const candidateIds = candidates.map((candidate) => candidate.id).join(', ');
  throw new Error(
    `Unable to resolve a unique context rule for ${contextRuleTypeKey(contextType)}. ` +
    `Matched ${candidates.length} rule(s)${candidateIds ? `: ${candidateIds}` : ''}.`,
  );
}

function contractSignersEqual(a: ContractSigner, b: ContractSigner): boolean {
  if (a.tag !== b.tag) return false;
  if (a.values[0] !== b.values[0]) return false;
  if (a.tag === 'External' && b.tag === 'External') {
    return externalSignerKeyDataEqual(a.values[1], b.values[1]);
  }
  return true;
}

function uniqueRules(rules: OnChainContextRule[]): OnChainContextRule[] {
  const seen = new Set<number>();
  const out: OnChainContextRule[] = [];
  for (const rule of rules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    out.push(rule);
  }
  return out.sort((a, b) => a.id - b.id);
}

async function resolveConnectedContextRuleIds(
  config: DeploymentConfig,
  state: SmartAccountState,
  entry: xdr.SorobanAuthorizationEntry,
): Promise<{ ids: number[]; signer: ContractSigner }> {
  if (!config.webauthnVerifierId) {
    throw new Error('WebAuthn verifier is not configured.');
  }
  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  const authContexts = buildAuthContextTypesFromTree(entry);
  const expectedContexts = countAuthContextsInTree(entry.rootInvocation());
  if (authContexts.length !== expectedContexts) {
    throw new Error(
      `Auth context count mismatch (${authContexts.length} parsed vs ${expectedContexts} expected). Refresh and retry.`,
    );
  }
  const rules = uniqueRules(await listOnChainContextRules(config, hydrated.smartAccountAddress));
  if (rules.length === 0) {
    throw new Error('No context rules found for connected smart account.');
  }

  const onChainKeyData = findPasskeyKeyDataInRules(
    rules,
    config.webauthnVerifierId,
    hydrated.credentialId,
  );
  if (!onChainKeyData) {
    throw new Error(
      'Passkey signer not found in smart account context rules. Create a new passkey smart account on Verify, fund it, then retry.',
    );
  }

  const candidateSigner: ContractSigner = {
    tag: 'External',
    values: [config.webauthnVerifierId, onChainKeyData],
  };

  const ids = authContexts.map((contextType) => (
    resolveContextRuleIdForContext(rules, contextType, candidateSigner)
  ));

  const matchedSigner =
    findPasskeySignerInContextRules(rules, ids, config.webauthnVerifierId, hydrated.credentialId) ??
    findPasskeySignerInRules(rules, config.webauthnVerifierId, hydrated.credentialId);
  if (!matchedSigner) {
    throw new Error(
      'Passkey signer not found for resolved context rules. Create a new passkey smart account and retry.',
    );
  }

  return { ids, signer: matchedSigner };
}

async function signAndSubmitWithOfficialAuthPayload(
  kit: SmartAccountKit,
  config: DeploymentConfig,
  state: SmartAccountState,
  transaction: SmartAccountAssembledTransaction,
): Promise<TransactionResult> {
  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  const kitAny = kit as unknown as KitSubmitInternals;
  const builtTx = transaction.built as Transaction | undefined;
  if (!builtTx) {
    return { success: false, hash: '', error: 'Transaction has no built transaction' };
  }
  const operations = builtTx.operations;
  if (operations.length !== 1 || operations[0].type !== 'invokeHostFunction') {
    return { success: false, hash: '', error: 'Expected exactly one invokeHostFunction operation' };
  }
  const authEntries = transaction.simulationData?.result?.auth as xdr.SorobanAuthorizationEntry[] | undefined;
  if (!authEntries) {
    return { success: false, hash: '', error: 'No simulation data or auth entries' };
  }

  const invokeOp = operations[0] as Operation.InvokeHostFunction;
  const signedAuthEntries: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of authEntries) {
    if (entry.credentials().switch().name !== 'sorobanCredentialsAddress') {
      signedAuthEntries.push(entry);
      continue;
    }
    const resolved = await resolveConnectedContextRuleIds(config, hydrated, entry);
    signedAuthEntries.push(await kit.signAuthEntry(entry, {
      credentialId: hydrated.credentialId,
      contextRuleIds: resolved.ids,
      signer: resolved.signer,
    } as never));
  }

  const sourceAccount = await kitAny.rpc.getAccount(SMART_ACCOUNT_DEPLOYER.publicKey());
  const resimTx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: kitAny.networkPassphrase,
  })
    .addOperation(Operation.invokeHostFunction({ func: invokeOp.func, auth: signedAuthEntries }))
    .setTimeout(kitAny.timeoutInSeconds)
    .build();

  const resimResult = await kitAny.rpc.simulateTransaction(resimTx);
  if (rpc.Api.isSimulationError(resimResult)) {
    return { success: false, hash: '', error: `Re-simulation failed: ${resimResult.error}` };
  }

  const normalizedTx = TransactionBuilder.fromXDR(resimTx.toXDR(), kitAny.networkPassphrase);
  const preparedTx = rpc.assembleTransaction(normalizedTx as Transaction, resimResult).build() as Transaction;
  const submissionOpts = { forceMethod: config.openZeppelinRelayerUrl ? 'relayer' as const : 'rpc' as const };
  if (!kitAny.shouldUseFeeSponsoring(submissionOpts) || kitAny.hasSourceAccountAuth(preparedTx)) {
    preparedTx.sign(kitAny.deployerKeypair ?? SMART_ACCOUNT_DEPLOYER);
  }
  return kitAny.sendAndPoll(preparedTx, submissionOpts);
}

export async function submitWithSmartAccount(
  config: DeploymentConfig,
  state: SmartAccountState,
  transaction: SmartAccountAssembledTransaction,
): Promise<string> {
  const kit = await connectPersonalSmartAccount(config, state);
  const result = await signAndSubmitWithOfficialAuthPayload(kit, config, state, transaction);
  return submitResultOrThrow(result, 'Smart account submission failed', config.rpcUrl);
}

export function isAssembledTransaction(tx: SignableTransaction): tx is SmartAccountAssembledTransaction {
  return typeof tx !== 'string' && Boolean(tx) && 'built' in tx;
}

export function isContractAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    Address.fromString(value);
    return value.startsWith('C');
  } catch {
    return false;
  }
}
