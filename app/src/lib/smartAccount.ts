import { Address } from '@stellar/stellar-sdk';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import base64url from 'base64url';
import {
  IndexedDBStorage,
  SmartAccountKit,
  type CreateWalletResult,
  type TransactionResult,
} from 'smart-account-kit';
import type { DeploymentConfig } from './config';
import { passkeyUserName } from './passkeyUserHandle';

export { passkeyUserName } from './passkeyUserHandle';

export type SmartAccountState = {
  smartAccountAddress: string;
  credentialId: string;
  /** Base64-encoded secp256r1 public key for passkey signing lookups. */
  passkeyPublicKey?: string;
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
    ...(config.passkeyRpId ? { rpId: config.passkeyRpId } : {}),
    webAuthn: {
      startRegistration: (options) => {
        clampRegistrationUserId(options.optionsJSON);
        return startRegistration(options);
      },
      startAuthentication,
    },
  });
}

function complianceInstallParam(config: DeploymentConfig): Record<string, unknown> {
  return {
    adapter: config.rwaAdapterId,
    policy_id: config.policyId,
  };
}

/** smart-account-kit-bindings decode stale ContextRule specs; avoid on-chain get_context_rules during signing. */
function patchWalletContextRulesLookup(
  kit: SmartAccountKit,
  config: DeploymentConfig,
  created: Pick<CreateWalletResult, 'credentialId' | 'publicKey'>,
): void {
  const wallet = kit.wallet as { get_context_rules?: (...args: unknown[]) => Promise<{ result: unknown[] }> } | undefined;
  if (!wallet?.get_context_rules || !config.webauthnVerifierId) return;

  const keyData = Buffer.concat([
    Buffer.from(created.publicKey),
    base64url.toBuffer(created.credentialId),
  ]);
  const defaultRule = {
    id: 0,
    context_type: { tag: 'Default' as const },
    name: 'default',
    policies: [] as string[],
    signers: [
      {
        tag: 'External' as const,
        values: [config.webauthnVerifierId, keyData],
      },
    ],
    valid_until: undefined,
  };

  (wallet as { get_context_rules: (args: { context_rule_type: { tag: string } }) => Promise<{ result: unknown[] }> })
    .get_context_rules = async (args) => ({
    result: args.context_rule_type.tag === 'Default' ? [defaultRule] : [],
  });
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
    ? await submitResultOrThrow(created.submitResult, 'Smart account deployment failed')
    : undefined;

  patchWalletContextRulesLookup(kit, config, created);

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
    passkeyPublicKey: Buffer.from(created.publicKey).toString('base64'),
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
  if (state.passkeyPublicKey) {
    patchWalletContextRulesLookup(kit, config, {
      credentialId: state.credentialId,
      publicKey: Buffer.from(state.passkeyPublicKey, 'base64'),
    });
  }
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
