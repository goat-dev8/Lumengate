import { Contract, rpc, xdr } from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';

export type ChainEventKind =
  | 'EligibilityVerified'
  | 'TransferGated'
  | 'PolicyRegistered'
  | 'RootUpdated'
  | 'RevocationRootUpdated'
  | 'HolderFrozen'
  | 'NullifierSpent'
  | 'UsdcTransferGated'
  | 'Unknown';

export type ChainEventRecord = {
  kind: ChainEventKind;
  contractId: string;
  txHash: string;
  ledger: number;
  ledgerClosedAt: string;
  summary: string;
  rawTopic: string[];
  source: 'contract_event' | 'chain_read';
};

function rpcServer(rpcUrl: string) {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
}

function scValToString(val: xdr.ScVal): string {
  switch (val.switch()) {
    case xdr.ScValType.scvSymbol():
      return val.sym().toString();
    case xdr.ScValType.scvString():
      return val.str().toString();
    case xdr.ScValType.scvAddress(): {
      const addr = val.address();
      if (addr.switch() === xdr.ScAddressType.scAddressTypeContract()) {
        return addr.contractId().toString('hex').toUpperCase();
      }
      return addr.accountId().toString();
    }
    case xdr.ScValType.scvU32():
      return String(val.u32());
    case xdr.ScValType.scvI128(): {
      const parts = val.i128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      const combined = (hi << 64n) + lo;
      return combined.toString();
    }
    default:
      try {
        return JSON.stringify(val.value());
      } catch {
        return val.switch().name;
      }
  }
}

function topicSymbol(topic: xdr.ScVal[]): string {
  const first = topic[0];
  if (!first || first.switch() !== xdr.ScValType.scvSymbol()) return '';
  return first.sym().toString();
}

const EVENT_ALIASES: Record<string, ChainEventKind> = {
  transfer_gated: 'TransferGated',
  TransferGated: 'TransferGated',
  usdc_transfer_gated: 'UsdcTransferGated',
  UsdcTransferGated: 'UsdcTransferGated',
  eligibility_verified: 'EligibilityVerified',
  EligibilityVerified: 'EligibilityVerified',
  policy_registered: 'PolicyRegistered',
  PolicyRegistered: 'PolicyRegistered',
  root_updated: 'RootUpdated',
  RootUpdated: 'RootUpdated',
  revocation_root_updated: 'RevocationRootUpdated',
  RevocationRootUpdated: 'RevocationRootUpdated',
  holder_frozen: 'HolderFrozen',
  HolderFrozen: 'HolderFrozen',
};

function classifyEvent(contractId: string, config: DeploymentConfig, topic: xdr.ScVal[]): ChainEventKind {
  const sym = topicSymbol(topic);
  const mapped = EVENT_ALIASES[sym];
  if (mapped) return mapped;

  if (contractId === config.policyVerifierId) return 'Unknown';
  if (contractId === config.rwaTokenId) return 'Unknown';
  if (config.complianceSacAdminId && contractId === config.complianceSacAdminId) return 'Unknown';
  if (contractId === config.credentialRegistryId) return 'Unknown';
  return 'Unknown';
}

function summarize(kind: ChainEventKind, contractId: string, topic: xdr.ScVal[]): string {
  switch (kind) {
    case 'EligibilityVerified':
      return 'PolicyVerifier recorded eligibility (UltraHonk + nullifier consumed)';
    case 'TransferGated':
      return 'RwaToken settled a proof-gated transfer';
    case 'UsdcTransferGated':
      return 'ComplianceSacAdmin settled a proof-gated USDC transfer';
    case 'PolicyRegistered':
      return 'Verification key registered for policy_id';
    case 'RootUpdated':
      return 'CredentialRegistry Merkle root updated';
    case 'RevocationRootUpdated':
      return 'CredentialRegistry revocation root updated';
    case 'HolderFrozen':
      return 'RwaToken holder freeze flag set';
    case 'NullifierSpent':
      return 'PolicyVerifier persistent storage marks nullifier spent (anti-replay)';
    default: {
      const sym = topicSymbol(topic);
      return sym
        ? `Contract event ${sym} from ${contractId.slice(0, 8)}…`
        : `Contract event from ${contractId.slice(0, 8)}…`;
    }
  }
}

function parseContractEventsFromMeta(
  txHash: string,
  ledger: number,
  ledgerClosedAt: string,
  config: DeploymentConfig,
  resultMetaXdr: xdr.TransactionMeta,
): ChainEventRecord[] {
  const out: ChainEventRecord[] = [];
  const metaSwitch = resultMetaXdr.switch();
  let contractEvents: xdr.ContractEvent[] = [];

  if (metaSwitch === 3 && resultMetaXdr.v3().sorobanMeta()) {
    contractEvents = resultMetaXdr.v3().sorobanMeta()!.events();
  }

  for (const ev of contractEvents) {
    const bodySwitch = ev.body().switch();
    if (bodySwitch !== 0) continue;
    const body = ev.body().v0();
    const topics = body.topics();
    const contractIdRaw = ev.contractId();
    if (!contractIdRaw) continue;
    const contractId = contractIdRaw.toString('hex').toUpperCase();
    const kind = classifyEvent(contractId, config, topics);
    out.push({
      kind,
      contractId,
      txHash,
      ledger,
      ledgerClosedAt,
      summary: summarize(kind, contractId, topics),
      rawTopic: topics.map((t) => scValToString(t)),
      source: 'contract_event',
    });
  }

  return out;
}

type RawGetTransaction = {
  status?: string;
  ledger?: number;
  createdAt?: number;
  resultMetaXdr?: string;
  events?: {
    contractEventsXdr?: string[][];
  };
};

function parseContractEventsFromRawResponse(
  txHash: string,
  ledger: number,
  ledgerClosedAt: string,
  config: DeploymentConfig,
  raw: RawGetTransaction,
): ChainEventRecord[] {
  if (raw.resultMetaXdr) {
    try {
      const meta = xdr.TransactionMeta.fromXDR(raw.resultMetaXdr, 'base64');
      return parseContractEventsFromMeta(txHash, ledger, ledgerClosedAt, config, meta);
    } catch {
      /* fall through */
    }
  }

  const nested = raw.events?.contractEventsXdr ?? [];
  const out: ChainEventRecord[] = [];
  for (const group of nested) {
    for (const xdrB64 of group) {
      try {
        const ev = xdr.ContractEvent.fromXDR(xdrB64, 'base64');
        if (ev.body().switch() !== 0) continue;
        const body = ev.body().v0();
        const topics = body.topics();
        const contractIdRaw = ev.contractId();
        if (!contractIdRaw) continue;
        const contractId = contractIdRaw.toString('hex').toUpperCase();
        const kind = classifyEvent(contractId, config, topics);
        out.push({
          kind,
          contractId,
          txHash,
          ledger,
          ledgerClosedAt,
          summary: summarize(kind, contractId, topics),
          rawTopic: topics.map((t) => scValToString(t)),
          source: 'contract_event',
        });
      } catch {
        /* skip malformed */
      }
    }
  }
  return out;
}

export async function fetchTransactionLedger(
  rpcUrl: string,
  txHash: string,
): Promise<{ ledger: number; createdAt: number } | null> {
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
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: RawGetTransaction };
  if (!json.result?.ledger || json.result.status !== 'SUCCESS') return null;
  return { ledger: json.result.ledger, createdAt: json.result.createdAt ?? 0 };
}

export async function fetchEventsForTransaction(
  config: DeploymentConfig,
  txHash: string,
): Promise<ChainEventRecord[]> {
  const s = rpcServer(config.rpcUrl);

  // Prefer raw RPC: Soroban testnet meta can exceed older SDK union parsers (switch 4).
  const res = await fetch(config.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `lumengate-events-${Date.now()}`,
      method: 'getTransaction',
      params: { hash: txHash },
    }),
  });
  if (res.ok) {
    const json = (await res.json()) as { result?: RawGetTransaction };
    if (json.result?.status === 'SUCCESS' && json.result.ledger) {
      const ledgerClosedAt = new Date((json.result.createdAt ?? 0) * 1000).toISOString();
      const parsed = parseContractEventsFromRawResponse(
        txHash,
        json.result.ledger,
        ledgerClosedAt,
        config,
        json.result,
      );
      if (parsed.length > 0) return parsed;
    }
  }

  try {
    const tx = await s.getTransaction(txHash);
    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const ledgerClosedAt = new Date(tx.createdAt * 1000).toISOString();
      const fromMeta = parseContractEventsFromMeta(
        txHash,
        tx.ledger,
        ledgerClosedAt,
        config,
        tx.resultMetaXdr,
      );
      if (fromMeta.length > 0) return fromMeta;
    }
  } catch {
    /* SDK parse failed */
  }

  // Fallback: getEvents (often empty on public testnet RPC — kept for future indexers)
  const meta = await fetchTransactionLedger(config.rpcUrl, txHash);
  if (!meta) return [];
  const contractIds = [config.policyVerifierId, config.rwaTokenId, config.credentialRegistryId];
  const response = await s.getEvents({
    startLedger: Math.max(1, meta.ledger - 2),
    endLedger: meta.ledger + 2,
    filters: [{ type: 'contract' as const, contractIds }],
    limit: 50,
  });
  return response.events
    .filter((ev) => ev.txHash.toLowerCase() === txHash.toLowerCase())
    .map((ev) => {
      const cid =
        ev.contractId instanceof Contract ? ev.contractId.contractId() : String(ev.contractId ?? '');
      const topic = ev.topic;
      const kind = classifyEvent(cid, config, topic);
      return {
        kind,
        contractId: cid,
        txHash: ev.txHash,
        ledger: ev.ledger,
        ledgerClosedAt: ev.ledgerClosedAt,
        summary: summarize(kind, cid, topic),
        rawTopic: topic.map((t) => scValToString(t)),
        source: 'contract_event' as const,
      };
    });
}

export async function fetchEventsForContracts(
  config: DeploymentConfig,
  opts?: { txHashes?: string[]; ledgerWindow?: number },
): Promise<ChainEventRecord[]> {
  const hashes = opts?.txHashes ?? [];
  if (hashes.length > 0) {
    const all: ChainEventRecord[] = [];
    for (const hash of hashes) {
      const evs = await fetchEventsForTransaction(config, hash);
      all.push(...evs);
    }
    return all;
  }

  const s = rpcServer(config.rpcUrl);
  const latest = await s.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - (opts?.ledgerWindow ?? 200_000));
  const contractIds = [config.policyVerifierId, config.rwaTokenId, config.credentialRegistryId];
  const response = await s.getEvents({
    startLedger,
    endLedger: latest.sequence,
    filters: [{ type: 'contract' as const, contractIds }],
    limit: 200,
  });
  return response.events.map((ev) => {
    const cid =
      ev.contractId instanceof Contract ? ev.contractId.contractId() : String(ev.contractId ?? '');
    const topic = ev.topic;
    const kind = classifyEvent(cid, config, topic);
    return {
      kind,
      contractId: cid,
      txHash: ev.txHash,
      ledger: ev.ledger,
      ledgerClosedAt: ev.ledgerClosedAt,
      summary: summarize(kind, cid, topic),
      rawTopic: topic.map((t) => scValToString(t)),
      source: 'contract_event' as const,
    };
  });
}

/** Synthetic evidence when nullifier is spent on-chain (not an emitted contract event). */
export function nullifierSpentEvidence(
  config: DeploymentConfig,
  txHash: string,
  ledger: number,
  nullifierHex: string,
): ChainEventRecord {
  return {
    kind: 'NullifierSpent',
    contractId: config.policyVerifierId,
    txHash,
    ledger,
    ledgerClosedAt: new Date().toISOString(),
    summary: `Nullifier 0x${nullifierHex.slice(0, 16)}… recorded spent on PolicyVerifier`,
    rawTopic: ['nullifier_spent', nullifierHex],
    source: 'chain_read',
  };
}
