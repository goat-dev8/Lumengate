import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import {
  IndexedDBStorage,
  SmartAccountKit,
  type CreateWalletResult,
  type TransactionResult,
} from 'smart-account-kit';
import type { DeploymentConfig } from './config';

export type SmartAccountState = {
  smartAccountAddress: string;
  credentialId: string;
  createdAt: number;
  deploymentHash?: string;
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
  });
}

function complianceInstallParam(config: DeploymentConfig): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('adapter'),
      val: nativeToScVal(config.rwaAdapterId, { type: 'address' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('policy_id'),
      val: nativeToScVal(config.policyId, { type: 'u32' }),
    }),
  ]);
}

async function submitResultOrThrow(result: TransactionResult, fallback: string): Promise<string> {
  if (!result.success || !result.hash) {
    throw new Error(result.error || fallback);
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
  const created: CreateWalletResult & { submitResult?: TransactionResult } = await kit.createWallet(
    'Lumengate',
    walletAddress,
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
    ? await submitResultOrThrow(created.submitResult, 'Smart account deployment failed')
    : undefined;

  const policyTx = await kit.policies.add(0, config.compliancePolicyId, complianceInstallParam(config));
  const policyResult = await kit.signAndSubmit(policyTx, {
    forceMethod: config.openZeppelinRelayerUrl ? 'relayer' : 'rpc',
  });
  const compliancePolicyTxHash = await submitResultOrThrow(
    policyResult,
    'Compliance policy installation failed',
  );

  return {
    smartAccountAddress: created.contractId,
    credentialId: created.credentialId,
    createdAt: Date.now(),
    deploymentHash,
    compliancePolicyInstalled: true,
    compliancePolicyTxHash,
  };
}

export async function connectPersonalSmartAccount(
  config: DeploymentConfig,
  state: SmartAccountState,
): Promise<SmartAccountKit> {
  const kit = createSmartAccountKit(config);
  await kit.connectWallet({
    contractId: state.smartAccountAddress,
    credentialId: state.credentialId,
  });
  return kit;
}

export async function submitWithSmartAccount(
  config: DeploymentConfig,
  state: SmartAccountState,
  transaction: SmartAccountAssembledTransaction,
): Promise<string> {
  const kit = await connectPersonalSmartAccount(config, state);
  const result = await kit.signAndSubmit(transaction as never, {
    forceMethod: config.openZeppelinRelayerUrl ? 'relayer' : 'rpc',
  });
  return submitResultOrThrow(result, 'Smart account submission failed');
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
