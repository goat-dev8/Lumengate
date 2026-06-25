import { Address, xdr } from '@stellar/stellar-sdk';
import type { Signer as ContractSigner } from 'smart-account-kit-bindings';
import {
  contextRuleTypeKey,
  contextRuleTypeMatches,
  externalSignerKeyDataEqual,
  type OnChainContextRule,
} from './onChainContextRules';

export type ContextRuleType = OnChainContextRule['context_type'];

/** One auth context per invocation-tree node (matches soroban-env-host). */
export function buildInvocationContextTypes(entry: xdr.SorobanAuthorizationEntry): ContextRuleType[] {
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
      throw new Error(`Unsupported authorized function type: ${switchName}`);
    }
    for (const sub of invocation.subInvocations()) {
      walk(sub);
    }
  };
  walk(entry.rootInvocation());
  return contexts;
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
    const execAny = executable as { switch?: () => { name: string }; wasm?: (() => Buffer) | Buffer };
    if (execAny.switch?.().name === 'contractExecutableWasm') {
      const wasm = typeof execAny.wasm === 'function' ? execAny.wasm() : execAny.wasm;
      if (wasm) return Buffer.from(wasm);
    }
  }
  return null;
}

function contractSignersEqual(a: ContractSigner, b: ContractSigner): boolean {
  if (a.tag !== b.tag) return false;
  if (a.values[0] !== b.values[0]) return false;
  if (a.tag === 'External' && b.tag === 'External') {
    return externalSignerKeyDataEqual(a.values[1], b.values[1]);
  }
  return true;
}

/** Match smart-account-kit@0.3.0 resolveContextRuleIdsForEntry using probed on-chain rules. */
export function resolveContextRuleIdsFromRules(
  rules: OnChainContextRule[],
  entry: xdr.SorobanAuthorizationEntry,
  selectedSigners: ContractSigner[],
): number[] {
  const contexts = buildInvocationContextTypes(entry);
  return contexts.map((contextType) => {
    const candidates = rules.filter((rule) => contextRuleTypeMatches(rule.context_type, contextType));
    if (candidates.length === 1) {
      return candidates[0].id;
    }

    const exactSignerMatches = candidates.filter((rule) => {
      if (rule.signers.length !== selectedSigners.length) return false;
      return (
        selectedSigners.every((selectedSigner) =>
          rule.signers.some((ruleSigner) => contractSignersEqual(ruleSigner, selectedSigner)),
        ) &&
        rule.signers.every((ruleSigner) =>
          selectedSigners.some((selectedSigner) => contractSignersEqual(ruleSigner, selectedSigner)),
        )
      );
    });
    if (exactSignerMatches.length === 1) {
      return exactSignerMatches[0].id;
    }

    const signerSubsetMatches = candidates.filter((rule) => {
      if (rule.policies.length > 0) return false;
      return rule.signers.every((ruleSigner) =>
        selectedSigners.some((selectedSigner) => contractSignersEqual(ruleSigner, selectedSigner)),
      );
    });
    if (signerSubsetMatches.length === 1) {
      return signerSubsetMatches[0].id;
    }

    const ids = candidates.map((candidate) => candidate.id).join(', ');
    throw new Error(
      `Unable to resolve a unique context rule for ${contextRuleTypeKey(contextType)}. ` +
      `Matched ${candidates.length} rule(s)${ids ? `: ${ids}` : ''}.`,
    );
  });
}
