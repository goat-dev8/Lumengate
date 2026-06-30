import {
  Account,
  Address,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import base64url from 'base64url';
import type { DeploymentConfig } from './config';

const SECP256R1_PUBLIC_KEY_SIZE = 65;
const DEFAULT_MAX_PROBED_RULE_ID = 8;
const DEFAULT_MAX_CONSECUTIVE_PROBE_MISSES = 3;

export type OnChainExternalSigner = {
  tag: 'External';
  values: [string, Buffer];
};

export type OnChainContextRule = {
  id: number;
  context_type: { tag: string; values?: unknown[] };
  name: string;
  policies: string[];
  signers: OnChainExternalSigner[];
  valid_until?: number;
};

/** scValToNative encodes Soroban enums as arrays, e.g. ["Default"] or ["CallContract", "C..."]. */
export function normalizeContextType(raw: unknown): OnChainContextRule['context_type'] {
  if (Array.isArray(raw) && raw.length > 0) {
    const tag = String(raw[0]);
    if (tag === 'Default') return { tag: 'Default' };
    if (tag === 'CallContract') return { tag: 'CallContract', values: [String(raw[1] ?? '')] };
    if (tag === 'CreateContract') {
      const wasm = coerceKeyDataBuffer(raw[1]);
      return wasm ? { tag: 'CreateContract', values: [wasm] } : { tag: 'CreateContract', values: [Buffer.alloc(0)] };
    }
  }
  if (raw && typeof raw === 'object' && 'tag' in raw) {
    const typed = raw as { tag?: unknown; values?: unknown[] };
    const tag = String(typed.tag ?? 'Default');
    if (tag === 'Default') return { tag: 'Default' };
    if (tag === 'CallContract') return { tag: 'CallContract', values: [String(typed.values?.[0] ?? '')] };
    if (tag === 'CreateContract') {
      const wasm = coerceKeyDataBuffer(typed.values?.[0]);
      return wasm ? { tag: 'CreateContract', values: [wasm] } : { tag: 'CreateContract', values: [Buffer.alloc(0)] };
    }
  }
  return { tag: 'Default' };
}

function contextRuleTypeToScVal(contextRuleType: { tag: string; values?: unknown[] }): xdr.ScVal {
  if (contextRuleType.tag === 'Default') {
    return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Default')]);
  }
  if (contextRuleType.tag === 'CallContract') {
    const contractAddress = String(contextRuleType.values?.[0] ?? '');
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('CallContract'),
      Address.fromString(contractAddress).toScVal(),
    ]);
  }
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('CreateContract'),
    xdr.ScVal.scvBytes(coerceKeyDataBuffer(contextRuleType.values?.[0]) ?? Buffer.alloc(0)),
  ]);
}

export function contextRuleTypeKey(contextType: OnChainContextRule['context_type']): string {
  if (contextType.tag === 'Default') return 'Default';
  if (contextType.tag === 'CallContract') return `CallContract:${contextType.values?.[0]}`;
  const wasm = coerceKeyDataBuffer(contextType.values?.[0]);
  return wasm ? `CreateContract:${wasm.toString('hex')}` : 'CreateContract:unknown';
}

export function contextRuleTypeMatches(
  ruleType: OnChainContextRule['context_type'],
  requiredType: OnChainContextRule['context_type'],
): boolean {
  return ruleType.tag === 'Default' || contextRuleTypeKey(ruleType) === contextRuleTypeKey(requiredType);
}

/** Coerce on-chain or stored key_data into a Buffer (browser-safe). */
export function coerceKeyDataBuffer(keyDataRaw: unknown): Buffer | null {
  if (Buffer.isBuffer(keyDataRaw)) return keyDataRaw;
  if (keyDataRaw instanceof Uint8Array) return Buffer.from(keyDataRaw);
  if (Array.isArray(keyDataRaw) && keyDataRaw.every((item) => typeof item === 'number')) {
    return Buffer.from(keyDataRaw);
  }
  if (typeof keyDataRaw === 'string') {
    const hex = keyDataRaw.replace(/^0x/i, '');
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      return Buffer.from(hex, 'hex');
    }
  }
  if (keyDataRaw && typeof keyDataRaw === 'object') {
    const maybe = keyDataRaw as { type?: string; data?: number[] };
    if (maybe.type === 'Buffer' && Array.isArray(maybe.data)) {
      return Buffer.from(maybe.data);
    }
  }
  return null;
}

function parseSigner(raw: unknown): OnChainExternalSigner | null {
  if (Array.isArray(raw)) {
    if (raw[0] === 'Delegated' && raw.length >= 2) {
      return { tag: 'Delegated', values: [String(raw[1])] } as unknown as OnChainExternalSigner;
    }
    if (raw[0] !== 'External' || raw.length < 3) return null;
    const verifier = String(raw[1]);
    const keyData = coerceKeyDataBuffer(raw[2]);
    if (!keyData) return null;
    return { tag: 'External', values: [verifier, keyData] };
  }
  if (!raw || typeof raw !== 'object') return null;
  const signer = raw as { tag?: string; values?: unknown[] };
  if (signer.tag === 'Delegated' && signer.values?.[0]) {
    return { tag: 'Delegated', values: [String(signer.values[0])] } as unknown as OnChainExternalSigner;
  }
  if (signer.tag !== 'External' || !Array.isArray(signer.values) || signer.values.length < 2) {
    return null;
  }
  const verifier = String(signer.values[0]);
  const keyData = coerceKeyDataBuffer(signer.values[1]);
  if (!keyData) return null;
  return { tag: 'External', values: [verifier, keyData] };
}

function parseContextRules(raw: unknown): OnChainContextRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: OnChainContextRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rule = item as Record<string, unknown>;
    const signers = Array.isArray(rule.signers)
      ? rule.signers.map(parseSigner).filter((s): s is OnChainExternalSigner => Boolean(s))
      : [];
    rules.push({
      id: Number(rule.id ?? 0),
      context_type: normalizeContextType(rule.context_type),
      name: String(rule.name ?? ''),
      policies: Array.isArray(rule.policies) ? rule.policies.map(String) : [],
      signers,
      valid_until: rule.valid_until == null ? undefined : Number(rule.valid_until),
    });
  }
  return rules;
}

function parseContextRule(raw: unknown): OnChainContextRule | null {
  const rules = parseContextRules([raw]);
  return rules[0] ?? null;
}

export function getCredentialIdFromKeyData(keyData: Buffer): string | null {
  if (keyData.length <= SECP256R1_PUBLIC_KEY_SIZE) return null;
  return base64url.encode(keyData.subarray(SECP256R1_PUBLIC_KEY_SIZE));
}

export function findPasskeyKeyDataInRules(
  rules: OnChainContextRule[],
  webauthnVerifierId: string,
  credentialId: string | Buffer,
): Buffer | null {
  const credentialBuffer = typeof credentialId === 'string'
    ? base64url.toBuffer(credentialId)
    : credentialId;
  for (const rule of rules) {
    for (const signer of rule.signers) {
      if (signer.values[0] !== webauthnVerifierId) continue;
      const keyData = signer.values[1];
      const encoded = getCredentialIdFromKeyData(keyData);
      if (typeof credentialId === 'string' && encoded === credentialId) {
        return keyData;
      }
      if (keyData.length <= credentialBuffer.length) continue;
      const suffix = keyData.subarray(keyData.length - credentialBuffer.length);
      if (suffix.equals(credentialBuffer)) {
        return keyData;
      }
    }
  }
  return null;
}

export function findPasskeySignerInRules(
  rules: OnChainContextRule[],
  webauthnVerifierId: string,
  credentialId: string,
): OnChainExternalSigner | null {
  for (const rule of rules) {
    for (const signer of rule.signers) {
      if (signer.values[0] !== webauthnVerifierId) continue;
      const keyData = coerceKeyDataBuffer(signer.values[1]);
      if (!keyData) continue;
      const encoded = getCredentialIdFromKeyData(keyData);
      if (encoded === credentialId) {
        return { tag: 'External', values: [signer.values[0], keyData] };
      }
      const credentialBuffer = base64url.toBuffer(credentialId);
      if (keyData.length > credentialBuffer.length) {
        const suffix = keyData.subarray(keyData.length - credentialBuffer.length);
        if (suffix.equals(credentialBuffer)) {
          return { tag: 'External', values: [signer.values[0], keyData] };
        }
      }
    }
  }
  return null;
}

/** Match smart-account-kit@0.3.0: resolve signer from the context rules being signed. */
export function findPasskeySignerInContextRules(
  rules: OnChainContextRule[],
  contextRuleIds: number[],
  webauthnVerifierId: string,
  credentialId: string | Buffer,
): OnChainExternalSigner | null {
  const credentialBuffer = typeof credentialId === 'string'
    ? base64url.toBuffer(credentialId)
    : credentialId;
  for (const ruleId of contextRuleIds) {
    const rule = rules.find((entry) => entry.id === ruleId);
    if (!rule) continue;
    for (const signer of rule.signers) {
      if (signer.values[0] !== webauthnVerifierId) continue;
      const keyData = coerceKeyDataBuffer(signer.values[1]);
      if (!keyData || keyData.length <= credentialBuffer.length) continue;
      const suffix = keyData.subarray(keyData.length - credentialBuffer.length);
      if (suffix.equals(credentialBuffer)) {
        return { tag: 'External', values: [signer.values[0], keyData] };
      }
    }
  }
  return null;
}

export function externalSignerKeyDataEqual(a: unknown, b: unknown): boolean {
  const left = coerceKeyDataBuffer(a);
  const right = coerceKeyDataBuffer(b);
  if (!left || !right) return false;
  return left.equals(right);
}

async function simulateContractCall(
  config: DeploymentConfig,
  smartAccountAddress: string,
  functionName: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal | null> {
  const s = new rpc.Server(config.rpcUrl);
  const tx = new TransactionBuilder(new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(smartAccountAddress).toScAddress(),
            functionName,
            args,
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result?.retval) {
    return null;
  }
  return sim.result.retval;
}

function decodeRequiredMapEntries(val: xdr.ScVal): Map<string, xdr.ScVal> {
  if (val.switch().name !== 'scvMap') {
    throw new Error(`Expected context rule result to be a map, got ${val.switch().name}`);
  }
  const entries = new Map<string, xdr.ScVal>();
  for (const entry of val.map() ?? []) {
    if (entry.key().switch().name !== 'scvSymbol') continue;
    entries.set(entry.key().sym().toString(), entry.val());
  }
  return entries;
}

function expectScVec(val: xdr.ScVal, label: string): xdr.ScVal[] {
  if (val.switch().name !== 'scvVec') {
    throw new Error(`Expected ${label} to be a vec, got ${val.switch().name}`);
  }
  return val.vec() ?? [];
}

function expectScU32(val: xdr.ScVal, label: string): number {
  if (val.switch().name !== 'scvU32') {
    throw new Error(`Expected ${label} to be a u32, got ${val.switch().name}`);
  }
  return val.u32();
}

function expectScString(val: xdr.ScVal, label: string): string {
  if (val.switch().name !== 'scvString') {
    throw new Error(`Expected ${label} to be a string, got ${val.switch().name}`);
  }
  return val.str().toString();
}

function expectScAddress(val: xdr.ScVal, label: string): string {
  if (val.switch().name !== 'scvAddress') {
    throw new Error(`Expected ${label} to be an address, got ${val.switch().name}`);
  }
  return Address.fromScAddress(val.address()).toString();
}

function expectScBytes(val: xdr.ScVal, label: string): Buffer {
  if (val.switch().name !== 'scvBytes') {
    throw new Error(`Expected ${label} to be bytes, got ${val.switch().name}`);
  }
  return Buffer.from(val.bytes());
}

function expectScSymbol(val: xdr.ScVal, label: string): string {
  if (val.switch().name !== 'scvSymbol') {
    throw new Error(`Expected ${label} to be a symbol, got ${val.switch().name}`);
  }
  return val.sym().toString();
}

function decodeContextRuleType(val: xdr.ScVal): OnChainContextRule['context_type'] {
  const parts = expectScVec(val, 'context_type');
  const tag = expectScSymbol(parts[0], 'context_type tag');
  if (tag === 'Default') return { tag: 'Default' };
  if (tag === 'CallContract') {
    return { tag: 'CallContract', values: [expectScAddress(parts[1], 'call contract address')] };
  }
  if (tag === 'CreateContract') {
    return { tag: 'CreateContract', values: [expectScBytes(parts[1], 'create contract wasm hash')] };
  }
  throw new Error(`Unknown context rule type tag: ${tag}`);
}

function decodeSigner(val: xdr.ScVal): OnChainExternalSigner {
  const parts = expectScVec(val, 'signer');
  const tag = expectScSymbol(parts[0], 'signer tag');
  if (tag === 'Delegated') {
    if (parts.length < 2) {
      throw new Error(`Delegated signer expected 2 items, got ${parts.length}`);
    }
    return {
      tag: 'Delegated',
      values: [expectScAddress(parts[1], 'delegated signer address')],
    } as unknown as OnChainExternalSigner;
  }
  if (tag !== 'External' || parts.length < 3) {
    throw new Error(`External signer expected 3 items, got ${parts.length} for tag ${tag}`);
  }
  return {
    tag: 'External',
    values: [expectScAddress(parts[1], 'external signer verifier'), expectScBytes(parts[2], 'external signer key data')],
  };
}

/** Decode get_context_rule retval without scValToNative enum/array ambiguity. */
export function decodeContextRuleResultXdr(resultXdr: string): OnChainContextRule {
  const scVal = xdr.ScVal.fromXDR(resultXdr, 'base64');
  const entries = decodeRequiredMapEntries(scVal);
  const policiesVal = entries.get('policies');
  const signersVal = entries.get('signers');
  const validUntilVal = entries.get('valid_until');
  if (!entries.has('context_type') || !entries.has('id') || !entries.has('name') || !policiesVal || !signersVal) {
    throw new Error('Context rule result is missing one or more required fields');
  }
  return {
    context_type: decodeContextRuleType(entries.get('context_type') as xdr.ScVal),
    id: expectScU32(entries.get('id') as xdr.ScVal, 'context rule id'),
    name: expectScString(entries.get('name') as xdr.ScVal, 'context rule name'),
    policies: expectScVec(policiesVal, 'policies').map((policy, index) =>
      expectScAddress(policy, `policy[${index}]`),
    ),
    signers: expectScVec(signersVal, 'signers').map((signer) => decodeSigner(signer)),
    valid_until: validUntilVal && validUntilVal.switch().name === 'scvU32'
      ? validUntilVal.u32()
      : undefined,
  };
}

/** Read one context rule via official get_context_rule(id). */
export async function readContextRuleById(
  config: DeploymentConfig,
  smartAccountAddress: string,
  contextRuleId: number,
): Promise<OnChainContextRule | null> {
  const retval = await simulateContractCall(
    config,
    smartAccountAddress,
    'get_context_rule',
    [xdr.ScVal.scvU32(contextRuleId)],
  );
  if (!retval) return null;
  try {
    return decodeContextRuleResultXdr(retval.toXDR('base64'));
  } catch {
    return parseContextRule(scValToNative(retval));
  }
}

/** Read active context rule count via official get_context_rules_count(). */
export async function readContextRulesCount(
  config: DeploymentConfig,
  smartAccountAddress: string,
): Promise<number> {
  const retval = await simulateContractCall(config, smartAccountAddress, 'get_context_rules_count', []);
  if (!retval || retval.switch().name !== 'scvU32') return 0;
  return retval.u32();
}

/** Probe get_context_rule(0..n) — bounded by on-chain rule count. */
export async function listOnChainContextRules(
  config: DeploymentConfig,
  smartAccountAddress: string,
  options?: { maxRuleId?: number; maxConsecutiveMisses?: number },
): Promise<OnChainContextRule[]> {
  const count = await readContextRulesCount(config, smartAccountAddress);
  const maxMisses = options?.maxConsecutiveMisses ?? DEFAULT_MAX_CONSECUTIVE_PROBE_MISSES;
  const cap = options?.maxRuleId ?? DEFAULT_MAX_PROBED_RULE_ID;
  const maxRuleId = Math.min(cap, Math.max(count + maxMisses, maxMisses));
  const rules: OnChainContextRule[] = [];
  let misses = 0;

  for (let contextRuleId = 0; contextRuleId <= maxRuleId; contextRuleId += 1) {
    const rule = await readContextRuleById(config, smartAccountAddress, contextRuleId);
    if (!rule) {
      misses += 1;
      if (misses >= maxMisses) break;
      continue;
    }
    misses = 0;
    rules.push(rule);
  }

  return rules.sort((a, b) => a.id - b.id);
}

async function fetchContextRulesByType(
  config: DeploymentConfig,
  smartAccountAddress: string,
  contextRuleType: { tag: string; values?: unknown[] },
): Promise<OnChainContextRule[]> {
  const retval = await simulateContractCall(
    config,
    smartAccountAddress,
    'get_context_rules',
    [contextRuleTypeToScVal(contextRuleType)],
  );
  if (!retval) return [];
  return parseContextRules(scValToNative(retval));
}

/** Read context rules filtered by type; falls back to probed get_context_rule entries. */
export async function fetchOnChainContextRules(
  config: DeploymentConfig,
  smartAccountAddress: string,
  contextRuleType: { tag: string; values?: unknown[] },
): Promise<OnChainContextRule[]> {
  const bulk = await fetchContextRulesByType(config, smartAccountAddress, contextRuleType);
  if (bulk.some((rule) => rule.signers.length > 0)) {
    return bulk;
  }

  const allRules = await listOnChainContextRules(config, smartAccountAddress);
  return allRules.filter((rule) => contextRuleTypeMatches(rule.context_type, contextRuleType));
}
