import { Address, hash, Keypair, StrKey, xdr } from '@stellar/stellar-sdk';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import base64url from 'base64url';
import { Client as SmartAccountClient } from 'smart-account-kit-bindings';
import {
  createCallContractContext,
  createDelegatedSigner,
  IndexedDBStorage,
  SmartAccountKit,
  type CreateWalletResult,
  type TransactionResult,
} from 'smart-account-kit';
import { waitForTransactionStatus } from './contracts';
import type { DeploymentConfig } from './config';
import {
  coerceKeyDataBuffer,
  findPasskeySignerInRules,
  listOnChainContextRules,
  type OnChainContextRule,
} from './onChainContextRules';
import { passkeyUserName } from './passkeyUserHandle';
import { extractRegistrationPublicKey } from './webauthnPublicKey';
import { runPasskeyCeremony } from './passkeyCeremony';

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
  'CBOBVPPXRKJ47LS7GGJASYL3H6CSPIOJGU3KN4HDPMJ2RSQR32UBINGZ',
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
const LUMENGATE_SESSION_DAYS = 7;
const LUMENGATE_SESSION_LEDGERS = LUMENGATE_SESSION_DAYS * 24 * 60 * 60 / 5;
const LUMENGATE_SESSION_STORAGE_PREFIX = 'lumengate.smartAccount.session.v1';

let connectedKitCache: {
  key: string;
  kit: SmartAccountKit;
} | null = null;

type LumengateSessionSigner = {
  smartAccountAddress: string;
  publicKey: string;
  secretKey: string;
  expiresAt: number;
};

export type LumengateSessionStatus = {
  enabled: boolean;
  publicKey: string | null;
  expiresAt: number | null;
  validUntilLedger: number | null;
  installedContracts: string[];
  missingContracts: string[];
};

function kitCacheKey(state: SmartAccountState): string {
  return `${state.smartAccountAddress}:${state.credentialId}`;
}

function sessionStorageKey(smartAccountAddress: string): string {
  return `${LUMENGATE_SESSION_STORAGE_PREFIX}:${smartAccountAddress}`;
}

function loadLumengateSession(smartAccountAddress: string): LumengateSessionSigner | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(smartAccountAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LumengateSessionSigner;
    if (
      parsed.smartAccountAddress !== smartAccountAddress ||
      !parsed.publicKey ||
      !parsed.secretKey ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }
    Keypair.fromSecret(parsed.secretKey);
    return parsed;
  } catch {
    return null;
  }
}

function saveLumengateSession(session: LumengateSessionSigner): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(sessionStorageKey(session.smartAccountAddress), JSON.stringify(session));
}

function revokeLumengateSessionStorage(smartAccountAddress: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(sessionStorageKey(smartAccountAddress));
}

export function revokeLumengateSession(smartAccountAddress: string): void {
  revokeLumengateSessionStorage(smartAccountAddress);
}

function getOrCreateLumengateSession(smartAccountAddress: string): LumengateSessionSigner {
  const existing = loadLumengateSession(smartAccountAddress);
  if (existing) return existing;
  const keypair = Keypair.random();
  const session: LumengateSessionSigner = {
    smartAccountAddress,
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    expiresAt: Date.now() + LUMENGATE_SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  saveLumengateSession(session);
  return session;
}

function ruleHasDelegatedSigner(rule: unknown, publicKey: string): boolean {
  const signers = (rule as { signers?: unknown[] })?.signers ?? [];
  return signers.some((signer) => {
    const typed = signer as { tag?: string; values?: unknown[] };
    return typed?.tag === 'Delegated' && String(typed.values?.[0] ?? '') === publicKey;
  });
}

function ruleHasCompliancePolicy(rule: unknown, config: DeploymentConfig): boolean {
  const policies = (rule as { policies?: unknown[] })?.policies ?? [];
  return Boolean(config.compliancePolicyId && policies.map(String).includes(config.compliancePolicyId));
}

function ruleMatchesCallContract(rule: unknown, contractId: string): boolean {
  const contextType = (rule as { context_type?: { tag?: string; values?: unknown[] } })?.context_type;
  return contextType?.tag === 'CallContract' && String(contextType.values?.[0] ?? '') === contractId;
}

function fallbackSessionContracts(config: DeploymentConfig): string[] {
  return [
    config.sessionStoreId,
    config.rwaAdapterId,
    config.rwaTokenId,
    config.complianceSacAdminId,
    config.compliantDexId,
    config.compliantPayrollId,
    config.usdcSacId,
    config.eurcSacId,
    config.confidentialTokenId,
    config.confidentialUnderlyingId,
  ].filter((id): id is string => Boolean(id));
}

function normalizeSessionContractIds(contractIds: string[]): string[] {
  const normalized = new Set<string>();
  for (const id of contractIds) {
    try {
      const address = Address.fromString(id).toString();
      if (address.startsWith('C')) normalized.add(address);
    } catch {
      // Ignore non-contract values.
    }
  }
  return [...normalized];
}

function sessionRuleIsUsable(
  rule: unknown,
  contractId: string,
  session: LumengateSessionSigner,
  config: DeploymentConfig,
  currentLedger: number,
): boolean {
  const expires = (rule as { valid_until?: number | null }).valid_until;
  return (
    ruleMatchesCallContract(rule, contractId) &&
    ruleHasDelegatedSigner(rule, session.publicKey) &&
    ruleHasCompliancePolicy(rule, config) &&
    (expires == null || Number(expires) > currentLedger + 100)
  );
}

function bestSessionRuleId(
  rules: unknown[],
  contractId: string,
  session: LumengateSessionSigner,
  config: DeploymentConfig,
  currentLedger: number,
): number | null {
  const matches = rules
    .filter((rule) => sessionRuleIsUsable(rule, contractId, session, config, currentLedger))
    .map((rule) => ({
      id: Number((rule as { id?: number }).id),
      validUntil: Number((rule as { valid_until?: number | null }).valid_until ?? 0),
    }))
    .filter(({ id }) => Number.isFinite(id));
  matches.sort((a, b) => b.validUntil - a.validUntil || b.id - a.id);
  return matches[0]?.id ?? null;
}

function callContractsFromInvocation(invocation: xdr.SorobanAuthorizedInvocation): string[] {
  const contracts: string[] = [];
  const fn = invocation.function();
  if (fn.switch().name === 'sorobanAuthorizedFunctionTypeContractFn') {
    const contractFn = fn.contractFn();
    contracts.push(Address.fromScAddress(contractFn.contractAddress()).toString());
  }
  for (const sub of invocation.subInvocations()) {
    contracts.push(...callContractsFromInvocation(sub));
  }
  return contracts;
}

function callContractsFromAuthEntry(entry: xdr.SorobanAuthorizationEntry): string[] {
  return callContractsFromInvocation(entry.rootInvocation());
}

function resolveSessionContextRuleIdsForEntry(
  entry: xdr.SorobanAuthorizationEntry,
  rules: unknown[],
  session: LumengateSessionSigner,
  config: DeploymentConfig,
  currentLedger: number,
): number[] {
  const contracts = callContractsFromAuthEntry(entry);
  if (contracts.length === 0) {
    throw new Error('Lumengate session can only authorize contract-call contexts.');
  }
  return contracts.map((contractId) => {
    const ruleId = bestSessionRuleId(rules, contractId, session, config, currentLedger);
    if (ruleId == null) {
      throw new Error(`Lumengate session is not enabled for ${contractId}.`);
    }
    return ruleId;
  });
}

export function invalidateSmartAccountKitCache(): void {
  connectedKitCache = null;
}

function clampRegistrationUserId(optionsJSON: { user?: { id?: string } }): void {
  const id = optionsJSON.user?.id;
  if (!id) return;
  const bytes = base64url.toBuffer(id);
  if (bytes.length <= 64) return;
  optionsJSON.user!.id = base64url(bytes.subarray(0, 64));
}

/** stellar-accounts 0.7.2 WebAuthn verifier requires the UV bit in authenticator_data (#3117). */
function requireUserVerificationOnAuth(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptionsJSON {
  return { ...optionsJSON, userVerification: 'required' };
}

function requireUserVerificationOnRegister(
  optionsJSON: PublicKeyCredentialCreationOptionsJSON,
): PublicKeyCredentialCreationOptionsJSON {
  const params = optionsJSON.pubKeyCredParams ?? [];
  const algs = new Set(params.map((p) => p.alg));
  const pubKeyCredParams = [...params];
  if (!algs.has(-7)) pubKeyCredParams.push({ alg: -7, type: 'public-key' });
  if (!algs.has(-257)) pubKeyCredParams.push({ alg: -257, type: 'public-key' });
  return {
    ...optionsJSON,
    pubKeyCredParams,
    authenticatorSelection: {
      ...optionsJSON.authenticatorSelection,
      residentKey: optionsJSON.authenticatorSelection?.residentKey ?? 'required',
      userVerification: 'required',
    },
  };
}

export function smartAccountStatus(config: DeploymentConfig): SmartAccountStatus {
  const missing: string[] = [];
  if (!config.lumengateSmartAccountWasmHash) missing.push('VITE_LUMENGATE_SMART_ACCOUNT_WASM_HASH');
  if (!config.webauthnVerifierId) missing.push('VITE_WEBAUTHN_VERIFIER_ID');
  if (!config.compliancePolicyId) missing.push('VITE_COMPLIANCE_POLICY_ID');
  if (!config.sessionStoreId) missing.push('VITE_SESSION_STORE_ID');
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
    relayerUrl: config.relayerEnabled ? config.openZeppelinRelayerUrl : undefined,
    // Soroban RPC rule probing — the default SDF indexer often times out in production browsers.
    indexerUrl: false,
    storage,
    contextRuleProbe: {
      maxRuleId: 64,
      maxConsecutiveMisses: 8,
    },
    rpName: 'Lumengate',
    rpId:
      config.passkeyRpId ??
      (typeof window !== 'undefined' ? window.location.hostname : undefined),
    webAuthn: {
      startRegistration: async (options: {
        optionsJSON: PublicKeyCredentialCreationOptionsJSON;
        useAutoRegister?: boolean;
      }) => {
        const optionsJSON = requireUserVerificationOnRegister(options.optionsJSON);
        clampRegistrationUserId(optionsJSON);
        const response = await runPasskeyCeremony('register', () =>
          startRegistration({ ...options, optionsJSON }),
        );
        const publicKey = extractRegistrationPublicKey(response.response);
        return {
          ...response,
          response: {
            ...response.response,
            publicKey: base64url(Buffer.from(publicKey)),
          },
        };
      },
      startAuthentication: async (options: {
        optionsJSON: PublicKeyCredentialRequestOptionsJSON;
        useBrowserAutofill?: boolean;
        verifyBrowserAutofillInput?: boolean;
      }) =>
        runPasskeyCeremony('authenticate', () =>
          startAuthentication({
            ...options,
            optionsJSON: requireUserVerificationOnAuth(options.optionsJSON),
            useBrowserAutofill: false,
          }),
        ),
    },
  });
}

/** CompliancePolicyParams encoded for Soroban Val (add_policy / deploy policies map). */
function complianceInstallParamScVal(config: DeploymentConfig): xdr.ScVal {
  if (!config.rwaAdapterId) {
    throw new Error('RWA adapter is not configured.');
  }
  if (!config.sessionStoreId) {
    throw new Error('Session store is not configured.');
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
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('session_store'),
      val: Address.fromString(config.sessionStoreId).toScVal(),
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

async function readContextRule0(
  config: DeploymentConfig,
  smartAccountAddress: string,
): Promise<OnChainContextRule | null> {
  const rules = await listOnChainContextRules(config, smartAccountAddress, {
    maxRuleId: 1,
    maxConsecutiveMisses: 2,
  });
  return rules.find((rule) => rule.id === 0) ?? rules[0] ?? null;
}

function normalizeContractId(contractId: string | undefined): string | null {
  const trimmed = contractId?.trim();
  if (!trimmed || !StrKey.isValidContract(trimmed)) return null;
  return Address.fromString(trimmed).toString();
}

export type LegacySmartAccountPolicyStatus = 'legacy' | 'current' | 'unknown';

/** Policy-only check for upgrade banner — unknown reads are NOT legacy. */
export async function getLegacySmartAccountPolicyStatus(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<LegacySmartAccountPolicyStatus> {
  if (!config.compliancePolicyId) return 'unknown';
  const expectedPolicyId = normalizeContractId(config.compliancePolicyId);
  if (!expectedPolicyId) return 'unknown';

  const rule0 = await readContextRule0(config, state.smartAccountAddress);
  if (!rule0?.policies?.length) return 'unknown';

  const onChainPolicyId = normalizeContractId(rule0.policies[0]);
  if (!onChainPolicyId) return 'unknown';
  if (onChainPolicyId === expectedPolicyId) return 'current';
  return 'legacy';
}

export async function isLegacySmartAccountPolicyOnChain(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<boolean> {
  return (await getLegacySmartAccountPolicyStatus(config, state)) === 'legacy';
}

const LEGACY_POLICY_PROBE_ATTEMPTS = 8;
const LEGACY_POLICY_PROBE_INTERVAL_MS = 1500;

/** Retry ambiguous RPC reads before deciding legacy vs current for UI gates. */
export async function resolveLegacySmartAccountPolicyForUi(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<boolean> {
  for (let attempt = 0; attempt < LEGACY_POLICY_PROBE_ATTEMPTS; attempt += 1) {
    const status = await getLegacySmartAccountPolicyStatus(config, state);
    if (status === 'legacy') return true;
    if (status === 'current') return false;
    if (attempt < LEGACY_POLICY_PROBE_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, LEGACY_POLICY_PROBE_INTERVAL_MS));
    }
  }
  return false;
}

/** Compare on-chain context rule 0 to deployment config (never trust session metadata alone). */
export async function isSmartAccountPolicyStaleOnChain(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<boolean> {
  if (!config.compliancePolicyId || !config.webauthnVerifierId) return false;
  const legacy = await getLegacySmartAccountPolicyStatus(config, state);
  if (legacy === 'legacy') return true;
  if (legacy === 'unknown') return false;
  const rule0 = await readContextRule0(config, state.smartAccountAddress);
  if (!rule0?.policies?.length) return false;
  const signer = findPasskeySignerInRules([rule0], config.webauthnVerifierId, state.credentialId);
  if (!signer) return true;
  const keyData = coerceKeyDataBuffer(signer.values[1]);
  if (!keyData) return true;
  const credBuffer = base64url.toBuffer(state.credentialId);
  if (keyData.length <= credBuffer.length) return true;
  const suffix = keyData.subarray(keyData.length - credBuffer.length);
  if (!suffix.equals(credBuffer)) return true;
  return false;
}

/** Settlement gate — retries ambiguous reads; blocks only on confirmed legacy or signer mismatch. */
export async function assertSmartAccountReadyForSettlement(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<void> {
  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const legacy = await getLegacySmartAccountPolicyStatus(config, state);
    if (legacy === 'legacy') {
      throw new Error(
        'This smart account uses a superseded on-chain compliance policy. ' +
          'Create a new passkey smart account on Verify, fund the new deposit address, then retry.',
      );
    }
    if (legacy === 'current') {
      const stale = await isSmartAccountPolicyStaleOnChain(config, state);
      if (stale) {
        throw new Error(
          'This smart account passkey signer does not match on-chain configuration. ' +
            'Create a new passkey smart account on Verify, then retry.',
        );
      }
      return;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, LEGACY_POLICY_PROBE_INTERVAL_MS));
    }
  }
  throw new Error('Smart account policy could not be verified on-chain yet. Wait a moment and retry.');
}

/** @deprecated Use isSmartAccountPolicyStaleOnChain — session metadata is not authoritative. */
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

/** Fill missing passkey metadata from on-chain context rule signers. */
export async function hydrateSmartAccountPasskeyMetadata(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<SmartAccountState> {
  if (!config.webauthnVerifierId) return state;
  const rule0 = await readContextRule0(config, state.smartAccountAddress);
  if (!rule0) return state;

  const onChainPolicy = rule0.policies[0];
  const signer = findPasskeySignerInRules([rule0], config.webauthnVerifierId, state.credentialId);
  const keyData = signer ? coerceKeyDataBuffer(signer.values[1]) : null;

  const next: SmartAccountState = {
    ...state,
    compliancePolicyId: onChainPolicy ?? state.compliancePolicyId,
    compliancePolicyInstalled: Boolean(onChainPolicy),
  };

  if (!keyData) return next;

  return {
    ...next,
    passkeyKeyDataHex: keyData.toString('hex'),
    passkeyPublicKey: keyData.subarray(0, 65).toString('base64'),
  };
}

async function ensurePasskeyCredentialInKitStorage(
  kit: SmartAccountKit,
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<void> {
  const kitStorage = (kit as unknown as { storage: SmartAccountKit['storage'] }).storage;
  const existing = await kitStorage.get(state.credentialId);
  if (existing?.publicKey?.length) return;
  if (!config.webauthnVerifierId) return;

  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  if (!hydrated.passkeyPublicKey) return;

  await kitStorage.save({
    credentialId: state.credentialId,
    publicKey: Buffer.from(hydrated.passkeyPublicKey, 'base64'),
    contractId: state.smartAccountAddress,
    nickname: 'Lumengate',
    createdAt: state.createdAt || Date.now(),
    isPrimary: true,
    deploymentStatus: 'deployed',
  });
}

async function submitResultOrThrow(
  result: TransactionResult,
  fallback: string,
  rpcUrl?: string,
): Promise<string> {
  if (result.hash && rpcUrl && result.error?.toLowerCase().includes('timed out')) {
    try {
      await waitForTransactionStatus(rpcUrl, result.hash, 45, 2000);
      return result.hash;
    } catch {
      // continue to error handling below
    }
  }
  if (!result.success || !result.hash) {
    const detail =
      result.hash && rpcUrl ? await readFailedTransactionDiagnostics(rpcUrl, result.hash) : '';
    throw new Error([result.error || fallback, detail].filter(Boolean).join(' — '));
  }
  if (rpcUrl) {
    await waitForTransactionStatus(rpcUrl, result.hash, 45, 2000);
  }
  return result.hash;
}

/** Soroban RPC can lag behind getTransaction SUCCESS; probe context rule 0 until it matches deploy config. */
async function waitUntilSmartAccountPolicyReady(
  config: DeploymentConfig,
  state: SmartAccountState,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<SmartAccountState> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const intervalMs = options?.intervalMs ?? 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
    if (!(await isSmartAccountPolicyStaleOnChain(config, hydrated))) {
      return hydrated;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error('Deployed smart account policy does not match deployment configuration.');
}

type KitAssembledTransaction = Parameters<SmartAccountKit['signAndSubmit']>[0];

function asKitAssembledTransaction(
  transaction: SmartAccountAssembledTransaction,
): KitAssembledTransaction {
  return transaction as KitAssembledTransaction;
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
      forceMethod: config.relayerEnabled && config.openZeppelinRelayerUrl ? 'relayer' : 'rpc',
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
    compliancePolicyId: config.compliancePolicyId,
    compliancePolicyInstalled: true,
    compliancePolicyTxHash: deploymentHash,
  };

  const hydrated = await waitUntilSmartAccountPolicyReady(config, createdState);

  return {
    ...hydrated,
    deploymentHash,
    compliancePolicyTxHash: deploymentHash,
  };
}

export async function connectPersonalSmartAccount(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<SmartAccountKit> {
  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  const cacheKey = kitCacheKey(hydrated);
  if (connectedKitCache?.key === cacheKey) {
    return connectedKitCache.kit;
  }
  const kit = createSmartAccountKit(config);
  await kit.connectWallet({
    contractId: hydrated.smartAccountAddress,
    credentialId: hydrated.credentialId,
  });
  await ensurePasskeyCredentialInKitStorage(kit, config, hydrated).catch(() => undefined);
  connectedKitCache = { key: cacheKey, kit };
  return kit;
}

export async function submitWithSmartAccount(
  config: DeploymentConfig,
  state: SmartAccountState,
  transaction: SmartAccountAssembledTransaction,
  options?: { forceMethod?: 'relayer' | 'rpc' },
): Promise<string> {
  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  await assertSmartAccountReadyForSettlement(config, hydrated);
  const kit = await connectPersonalSmartAccount(config, hydrated);
  // Do NOT wrap signAndSubmit in runPasskeyCeremony — webAuthn callbacks already use it.
  // Nesting ceremonies deadlocks before the passkey prompt (infinite loading on Authorize).
  const result = await kit.signAndSubmit(asKitAssembledTransaction(transaction), {
    credentialId: hydrated.credentialId,
    forceMethod: options?.forceMethod ?? (config.relayerEnabled && config.openZeppelinRelayerUrl ? 'relayer' : 'rpc'),
  });
  return submitResultOrThrow(result, 'Smart account submission failed', config.rpcUrl);
}

async function listSessionContextRules(
  config: DeploymentConfig,
  smartAccountAddress: string,
): Promise<unknown[]> {
  return listOnChainContextRules(config, smartAccountAddress, {
    maxRuleId: 64,
    maxConsecutiveMisses: 8,
  });
}

async function ensureLumengateSessionRule(
  config: DeploymentConfig,
  kit: SmartAccountKit,
  session: LumengateSessionSigner,
  contractIds: string[],
  options?: { installWithPasskey?: boolean },
): Promise<unknown[]> {
  if (!config.compliancePolicyId) {
    throw new Error('Compliance policy is not configured.');
  }
  const latest = await kit.rpc.getLatestLedger();
  const currentLedger = Number(latest.sequence ?? 0);
  const validUntil = currentLedger + Math.round(LUMENGATE_SESSION_LEDGERS);
  let existingRules = await listSessionContextRules(config, session.smartAccountAddress);
  const targets = normalizeSessionContractIds(contractIds);
  if (targets.length === 0) {
    throw new Error('No Lumengate contract context available for session setup.');
  }

  const missing = targets.filter(
    (contractId) =>
      !existingRules.some((rule) => sessionRuleIsUsable(rule, contractId, session, config, currentLedger)),
  );
  if (missing.length === 0) return existingRules;

  const installMissingRules = async () => {
    for (const contractId of missing) {
      const signer = createDelegatedSigner(session.publicKey);
      const policies = new Map<string, xdr.ScVal>();
      policies.set(config.compliancePolicyId!, complianceInstallParamScVal(config));
      const ruleTx = await kit.rules.add(
        createCallContractContext(contractId),
        'Lumen Session',
        [signer],
        policies,
        validUntil,
      );
      const result = await kit.signAndSubmit(ruleTx, {
        credentialId: kit.credentialId,
        forceMethod: config.relayerEnabled && config.openZeppelinRelayerUrl ? 'relayer' : 'rpc',
      });
      await submitResultOrThrow(result, 'Lumengate session setup failed', config.rpcUrl);
      existingRules = await listSessionContextRules(config, session.smartAccountAddress);
    }
  };

  if (options?.installWithPasskey !== false) {
    await runPasskeyCeremony('enable-session', installMissingRules);
  }

  return existingRules;
}

export async function enableLumengateSession(
  config: DeploymentConfig,
  state: SmartAccountState,
  contractIds?: string[],
): Promise<LumengateSessionStatus> {
  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  await assertSmartAccountReadyForSettlement(config, hydrated);
  invalidateSmartAccountKitCache();
  const kit = await connectPersonalSmartAccount(config, hydrated);
  const session = getOrCreateLumengateSession(hydrated.smartAccountAddress);
  const targetContracts = normalizeSessionContractIds(contractIds?.length ? contractIds : fallbackSessionContracts(config));
  const rules = await ensureLumengateSessionRule(config, kit, session, targetContracts, {
    installWithPasskey: true,
  });
  const latest = await kit.rpc.getLatestLedger();
  const currentLedger = Number(latest.sequence ?? 0);
  const installedContracts = targetContracts.filter(
    (contractId) => bestSessionRuleId(rules, contractId, session, config, currentLedger) != null,
  );
  const missingContracts = targetContracts.filter((contractId) => !installedContracts.includes(contractId));
  const validUntilLedger = installedContracts.reduce<number | null>((max, contractId) => {
    const rule = rules.find((candidate) => {
      const id = bestSessionRuleId(rules, contractId, session, config, currentLedger);
      return Number((candidate as { id?: number }).id) === id;
    });
    const validUntil = Number((rule as { valid_until?: number | null } | undefined)?.valid_until ?? 0);
    return validUntil ? Math.max(max ?? 0, validUntil) : max;
  }, null);
  return {
    enabled: missingContracts.length === 0,
    publicKey: session.publicKey,
    expiresAt: session.expiresAt,
    validUntilLedger,
    installedContracts,
    missingContracts,
  };
}

export async function getLumengateSessionStatus(
  config: DeploymentConfig,
  state: SmartAccountState,
  contractIds?: string[],
): Promise<LumengateSessionStatus> {
  const session = loadLumengateSession(state.smartAccountAddress);
  const targetContracts = normalizeSessionContractIds(contractIds?.length ? contractIds : fallbackSessionContracts(config));
  if (!session) {
    return {
      enabled: false,
      publicKey: null,
      expiresAt: null,
      validUntilLedger: null,
      installedContracts: [],
      missingContracts: targetContracts,
    };
  }
  const kit = await connectPersonalSmartAccount(config, state);
  const latest = await kit.rpc.getLatestLedger();
  const currentLedger = Number(latest.sequence ?? 0);
  const rules = await listSessionContextRules(config, state.smartAccountAddress);
  const installedContracts = targetContracts.filter(
    (contractId) => bestSessionRuleId(rules, contractId, session, config, currentLedger) != null,
  );
  const missingContracts = targetContracts.filter((contractId) => !installedContracts.includes(contractId));
  const validUntilLedger = installedContracts.reduce<number | null>((max, contractId) => {
    const ruleId = bestSessionRuleId(rules, contractId, session, config, currentLedger);
    const rule = rules.find((candidate) => Number((candidate as { id?: number }).id) === ruleId);
    const validUntil = Number((rule as { valid_until?: number | null } | undefined)?.valid_until ?? 0);
    return validUntil ? Math.max(max ?? 0, validUntil) : max;
  }, null);
  return {
    enabled: missingContracts.length === 0,
    publicKey: session.publicKey,
    expiresAt: session.expiresAt,
    validUntilLedger,
    installedContracts,
    missingContracts,
  };
}

export async function submitWithLumengateSession(
  config: DeploymentConfig,
  state: SmartAccountState,
  transaction: SmartAccountAssembledTransaction,
  options?: { forceMethod?: 'relayer' | 'rpc'; allowSetup?: boolean },
): Promise<string> {
  const hydrated = await hydrateSmartAccountPasskeyMetadata(config, state);
  await assertSmartAccountReadyForSettlement(config, hydrated);
  const kit = await connectPersonalSmartAccount(config, hydrated);
  const session = loadLumengateSession(hydrated.smartAccountAddress);
  if (!session) {
    throw new Error('Enable Trusted device (7 days) before using delegated session signing.');
  }
  const rules = await listSessionContextRules(config, state.smartAccountAddress);
  const latest = await kit.rpc.getLatestLedger();
  const currentLedger = Number(latest.sequence ?? 0);
  kit.externalSigners.addFromSecret(session.secretKey);
  const sessionSigner = createDelegatedSigner(session.publicKey);
  const selected = kit.multiSigners.buildSelectedSigners([sessionSigner], undefined);
  const result = await kit.multiSigners.operation(asKitAssembledTransaction(transaction), selected, {
    forceMethod: options?.forceMethod ?? (config.relayerEnabled && config.openZeppelinRelayerUrl ? 'relayer' : 'rpc'),
    resolveContextRuleIds: async (entry: xdr.SorobanAuthorizationEntry) =>
      resolveSessionContextRuleIdsForEntry(entry, rules, session, config, currentLedger),
  });
  return submitResultOrThrow(result, 'Lumengate session submission failed', config.rpcUrl);
}

export async function submitSmartAccountOperation(
  config: DeploymentConfig,
  state: SmartAccountState,
  transaction: SmartAccountAssembledTransaction,
  options?: { forceMethod?: 'relayer' | 'rpc' },
): Promise<string> {
  const sessionStatus = await getLumengateSessionStatus(config, state);
  if (sessionStatus.enabled) {
    return submitWithLumengateSession(config, state, transaction, options);
  }
  return submitWithSmartAccount(config, state, transaction, options);
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
