import type { DeploymentConfig } from './config';
import type { IssuerCredentialResponse } from './config';
import type { ProofBundle } from './contracts';
import {
  nullifierHexFromBundle,
  readNullifierSpent,
  readOnChainRoots,
} from './contracts';
import { loadActivity } from './activity';
import { loadComplianceAssetTargets } from './assets';
import type { ChainEventRecord } from './events';
import { fetchEventsForTransaction, fetchTransactionLedger, nullifierSpentEvidence } from './events';
import { policyByKey, type PolicyKey } from './policies';
import { rootsMatchCredential } from './passport';
import { explorerTxUrl } from './utils';
import {
  PUBLIC_INPUTS_BYTES,
  ULTRA_HONK_PROOF_BYTES,
} from './contracts';

export type SettlementStatus = 'pending' | 'verified' | 'failed';

export type ProofReceiptTransactions = {
  verify?: string;
  transfer?: string;
  pofVerify?: string;
};

export type ProofReceiptTransferResult = {
  from: string;
  to: string;
  amount: string;
  success: boolean;
};

export type ProofReceipt = {
  version: 2;
  productLabel: string;
  tagline: string;
  createdAt: number;
  walletAddress: string;
  walletField: string;
  walletModuleId?: string;
  walletModuleName?: string;
  policyKey: PolicyKey;
  policyId: number;
  claims: string[];
  verificationResult: 'passed' | 'failed' | 'pending';
  settlementStatus: SettlementStatus;
  nullifier: string;
  nullifierSpent: boolean;
  replayBlocked: boolean;
  replayMessage?: string;
  merkleRoot: string;
  revocationRoot: string;
  rootsMatchOnChain: boolean;
  proofPublicInputsHex: string;
  verifierVersion: {
    stack: string;
    proofBytes: number;
    publicInputBytes: number;
    sorobanSdk: string;
    protocol: string;
  };
  network: string;
  contractIds: {
    policyVerifier: string;
    credentialRegistry: string;
    issuerRegistry: string;
    rwaToken: string;
    rwaAdapter: string;
  };
  transactions: ProofReceiptTransactions;
  transferResult?: ProofReceiptTransferResult;
  events: ChainEventRecord[];
  complianceTargets: ReturnType<typeof loadComplianceAssetTargets>;
  explorerLinks: Record<string, string>;
  ledgerCloseTime?: string;
  verificationTimestamp?: string;
  asset: {
    label: string;
    contractId: string;
    complianceTarget: string;
    complianceSac: string;
  };
};

export type BuildProofReceiptInput = {
  config: DeploymentConfig;
  address: string;
  walletField: string;
  walletModuleId?: string;
  walletModuleName?: string;
  policyKey: PolicyKey;
  credential: IssuerCredentialResponse | null;
  proof: ProofBundle | null;
  transactions?: ProofReceiptTransactions;
  transferResult?: ProofReceiptTransferResult;
  replayBlocked?: boolean;
  replayMessage?: string;
  events?: ChainEventRecord[];
};

/** Prefer session tx hash; fall back to latest successful transfer in activity feed. */
export function resolveReceiptTransactions(
  sessionTxs: ProofReceiptTransactions = {},
): ProofReceiptTransactions {
  if (sessionTxs.transfer) return sessionTxs;
  const latest = loadActivity().find(
    (entry) => entry.kind === 'transfer' && entry.txHash && entry.status === 'success',
  );
  if (!latest?.txHash) return sessionTxs;
  return { ...sessionTxs, transfer: latest.txHash };
}

export async function buildProofReceipt(input: BuildProofReceiptInput): Promise<ProofReceipt | null> {
  const { config, address, walletField, proof, credential, policyKey } = input;
  if (!proof || !credential) return null;

  const policy = policyByKey(policyKey);
  const nullifier = nullifierHexFromBundle(proof);
  let nullifierSpent = false;
  let rootsMatchOnChain = false;
  let onChainRoots = { root: '', revocationRoot: '' };

  try {
    onChainRoots = await readOnChainRoots(config);
    rootsMatchOnChain = rootsMatchCredential(onChainRoots, credential);
    nullifierSpent = await readNullifierSpent(
      config,
      nullifier,
      Number(proof.publicInputs.policyId),
    );
  } catch {
    /* RPC unavailable — leave flags false */
  }

  const txs = resolveReceiptTransactions(input.transactions ?? {});
  const events: ChainEventRecord[] = input.events ?? [];
  if (events.length === 0) {
    const hashes = [txs.transfer, txs.verify, txs.pofVerify].filter(Boolean) as string[];
    for (const hash of hashes) {
      const evs = await fetchEventsForTransaction(config, hash);
      events.push(...evs);
    }
  }

  if (nullifierSpent && txs.transfer) {
    const meta = await fetchTransactionLedger(config.rpcUrl, txs.transfer).catch(() => null);
    events.push(
      nullifierSpentEvidence(
        config,
        txs.transfer,
        meta?.ledger ?? 0,
        nullifier.replace(/^0x/i, ''),
      ),
    );
  }

  const ledgerCloseTime = events[0]?.ledgerClosedAt;
  let verificationTimestamp: string | undefined;
  if (txs.transfer) {
    const meta = await fetchTransactionLedger(config.rpcUrl, txs.transfer).catch(() => null);
    if (meta?.createdAt) verificationTimestamp = new Date(meta.createdAt * 1000).toISOString();
  }
  const targets = loadComplianceAssetTargets();
  const hasTransferTx = Boolean(txs.transfer);
  const transferSucceeded = input.transferResult?.success !== false;
  const settlementVerified =
    hasTransferTx && transferSucceeded && nullifierSpent && rootsMatchOnChain;
  const settlementStatus: SettlementStatus = settlementVerified
    ? 'verified'
    : hasTransferTx && input.transferResult?.success === false
      ? 'failed'
      : 'pending';
  const verificationResult: ProofReceipt['verificationResult'] = settlementVerified
    ? 'passed'
    : input.replayBlocked
      ? 'passed'
      : proof
        ? 'pending'
        : 'failed';

  const explorerLinks: Record<string, string> = {};
  if (txs.verify) explorerLinks.verify = explorerTxUrl(config.explorerBaseUrl, txs.verify);
  if (txs.transfer) explorerLinks.transfer = explorerTxUrl(config.explorerBaseUrl, txs.transfer);
  if (txs.pofVerify) explorerLinks.pofVerify = explorerTxUrl(config.explorerBaseUrl, txs.pofVerify);

  return {
    version: 2,
    productLabel: 'Lumengate settlement receipt',
    tagline: 'Your identity stays private. Your settlement stays verifiable.',
    createdAt: Date.now(),
    walletAddress: address,
    walletField,
    walletModuleId: input.walletModuleId,
    walletModuleName: input.walletModuleName,
    policyKey,
    policyId: policy.policyId,
    claims: policy.claims,
    verificationResult,
    settlementStatus,
    nullifier,
    nullifierSpent,
    replayBlocked: Boolean(input.replayBlocked),
    replayMessage: input.replayMessage,
    merkleRoot: proof.publicInputs.root,
    revocationRoot: proof.publicInputs.revocationRoot,
    rootsMatchOnChain,
    proofPublicInputsHex: proof.publicInputsHex,
    verifierVersion: {
      stack: 'Private eligibility confirmation',
      proofBytes: ULTRA_HONK_PROOF_BYTES,
      publicInputBytes: PUBLIC_INPUTS_BYTES,
      sorobanSdk: '26.0.1',
      protocol: 'Stellar Protocol 25/26 (X-Ray / Yardstick)',
    },
    network: config.network,
    contractIds: {
      policyVerifier: config.policyVerifierId,
      credentialRegistry: config.credentialRegistryId,
      issuerRegistry: config.issuerRegistryId,
      rwaToken: config.rwaTokenId,
      rwaAdapter: config.rwaAdapterId,
    },
    transactions: txs,
    transferResult: input.transferResult,
    events,
    complianceTargets: targets,
    explorerLinks,
    ledgerCloseTime,
    verificationTimestamp,
    asset: {
      label: 'Treasury units',
      contractId: config.rwaTokenId,
      complianceTarget: targets.usdcCode,
      complianceSac: targets.usdcSac,
    },
  };
}

export function proofReceiptFilename(address: string): string {
  return `lumengate-proof-receipt-${address.slice(0, 8)}.json`;
}
