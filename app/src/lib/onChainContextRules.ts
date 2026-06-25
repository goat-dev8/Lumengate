import { Account, Address, Contract, rpc, scValToNative, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';

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
    xdr.ScVal.scvBytes(Buffer.from(contextRuleType.values?.[0] as Buffer)),
  ]);
}

function parseSigner(raw: unknown): OnChainExternalSigner | null {
  if (!raw || typeof raw !== 'object') return null;
  const signer = raw as { tag?: string; values?: unknown[] };
  if (signer.tag !== 'External' || !Array.isArray(signer.values) || signer.values.length < 2) {
    return null;
  }
  const verifier = String(signer.values[0]);
  const keyDataRaw = signer.values[1];
  const keyData = Buffer.isBuffer(keyDataRaw)
    ? keyDataRaw
    : keyDataRaw instanceof Uint8Array
      ? Buffer.from(keyDataRaw)
      : null;
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
      context_type: (rule.context_type as OnChainContextRule['context_type']) ?? { tag: 'Default' },
      name: String(rule.name ?? ''),
      policies: Array.isArray(rule.policies) ? rule.policies.map(String) : [],
      signers,
      valid_until: rule.valid_until == null ? undefined : Number(rule.valid_until),
    });
  }
  return rules;
}

/** Read context rules from LumengateSmartAccount.get_context_rules (on-chain source of truth). */
export async function fetchOnChainContextRules(
  config: DeploymentConfig,
  smartAccountAddress: string,
  contextRuleType: { tag: string; values?: unknown[] },
): Promise<OnChainContextRule[]> {
  const s = new rpc.Server(config.rpcUrl);
  const contract = new Contract(smartAccountAddress);
  const source = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const tx = new TransactionBuilder(source, {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('get_context_rules', contextRuleTypeToScVal(contextRuleType)))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result?.retval) {
    return [];
  }
  return parseContextRules(scValToNative(sim.result.retval));
}

export function findPasskeyKeyDataInRules(
  rules: OnChainContextRule[],
  webauthnVerifierId: string,
  credentialId: Buffer,
): Buffer | null {
  const suffixSize = credentialId.length;
  for (const rule of rules) {
    for (const signer of rule.signers) {
      if (signer.values[0] !== webauthnVerifierId) continue;
      const keyData = signer.values[1];
      if (keyData.length <= 65) continue;
      const suffix = keyData.subarray(keyData.length - suffixSize);
      if (suffix.equals(credentialId)) {
        return keyData;
      }
    }
  }
  return null;
}
