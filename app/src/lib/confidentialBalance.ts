import type { DeploymentConfig } from './config';
import { resolveCtKeys } from './confidentialFlow';
import { ChainClient } from './confidentialToken/chain/client';
import { IndexerClient } from './confidentialToken/chain/indexer';
import { IssuerCtIndexerClient } from './confidentialToken/chain/issuer-indexer';
import { LocalStorageStore } from './confidentialToken/state/browser-store';
import { StateEngine } from './confidentialToken/state/engine';
import { reviveState } from './confidentialToken/state/store';
import { readCtRegistrationStatus, markCtRegisteredLocally, isCtRegisteredLocally } from './ctRegistration';

export type ConfidentialEurcBalance = {
  registered: boolean;
  spendable: bigint;
  receiving: bigint;
  total: bigint;
  spendableSynced: boolean;
  receivingSynced: boolean;
  synced: boolean;
  syncError?: string;
  /** True when this snapshot came from the local cache and is not yet verified against chain. */
  provisional?: boolean;
};

/**
 * Instant, network-free balance snapshot from local storage. Used to render the
 * registered pill and last-known balance immediately while the verified read
 * runs in the background — so a passkey account that already registered never
 * flashes "Checking…/Not registered".
 */
export function readCachedConfidentialEurcBalance(
  config: DeploymentConfig,
  smartAccount: string,
): ConfidentialEurcBalance | null {
  if (!config.confidentialTokenId || typeof localStorage === 'undefined') return null;
  const tokenId = config.confidentialTokenId;
  const registeredLocal = isCtRegisteredLocally(smartAccount, tokenId);
  let spendable = 0n;
  let receiving = 0n;
  let stateRegistered = false;
  const raw = localStorage.getItem(`lumengate:ct:state:${tokenId}:${smartAccount}`);
  if (raw) {
    try {
      const state = reviveState(JSON.parse(raw) as Record<string, unknown>);
      spendable = state.spendable.v;
      receiving = state.receiving.v;
      stateRegistered = state.registered;
    } catch {
      /* ignore malformed cache */
    }
  }
  const registered = registeredLocal || stateRegistered;
  if (!registered) return null;
  return {
    registered: true,
    spendable,
    receiving,
    total: spendable + receiving,
    spendableSynced: false,
    receivingSynced: false,
    synced: false,
    provisional: true,
  };
}

function ctChainClient(config: DeploymentConfig): ChainClient {
  if (!config.confidentialTokenId || !config.confidentialVerifierId || !config.confidentialAuditorId) {
    throw new Error('Confidential token contracts are not configured.');
  }
  return new ChainClient({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    contracts: {
      token: config.confidentialTokenId,
      verifier: config.confidentialVerifierId,
      auditor: config.confidentialAuditorId,
    },
  });
}

type CtHistoryIndexer = IndexerClient | IssuerCtIndexerClient;

/** Resolve the durable CT event backfill client (issuer `/ct/events` or Goldsky Worker). */
function ctIndexer(config: DeploymentConfig): CtHistoryIndexer | undefined {
  const issuerBase = config.issuerServiceUrl?.replace(/\/$/, '');
  const configured = config.confidentialIndexerUrl?.replace(/\/$/, '');

  // Lumengate issuer `/ct` is NOT the Goldsky Worker API. Using IndexerClient
  // against it 404s and silently drops pre-window history during hybrid sync.
  if (configured && issuerBase && (configured === `${issuerBase}/ct` || configured.endsWith('/ct'))) {
    return new IssuerCtIndexerClient({ baseUrl: issuerBase });
  }
  if (configured && !configured.endsWith('/ct')) {
    return new IndexerClient({ baseUrl: configured });
  }
  if (issuerBase) {
    return new IssuerCtIndexerClient({ baseUrl: issuerBase });
  }
  return undefined;
}

/** Authoritative cold-start initialization after CT register (demo wallet.refresh baseline). */
export async function initializeCtStateFromEvents(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<void> {
  const engine = await createConfidentialEurcStateEngine(config, smartAccount);
  await engine.rebuildFromEvents();
  await engine.verifyAgainstChain();
}

export async function createConfidentialEurcStateEngine(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<StateEngine> {
  const keys = await resolveCtKeys(config, smartAccount);
  const client = ctChainClient(config);
  const fromLedger = Math.max(
    0,
    config.confidentialDeployedAtLedger ?? (await client.latestLedger()) - 50_000,
  );
  return new StateEngine({
    client,
    store: new LocalStorageStore(`lumengate:ct:state:${config.confidentialTokenId}:`),
    keys,
    address: smartAccount,
    fromLedger,
    indexer: ctIndexer(config),
  });
}

export async function readConfidentialEurcBalance(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<ConfidentialEurcBalance> {
  const registration = await readCtRegistrationStatus(config, smartAccount);
  if (!registration.registered || !config.confidentialTokenId) {
    return {
      registered: false,
      spendable: 0n,
      receiving: 0n,
      total: 0n,
      spendableSynced: true,
      receivingSynced: true,
      synced: true,
    };
  }

  try {
    const engine = await createConfidentialEurcStateEngine(config, smartAccount);
    const { state, verified } = await engine.reconcileForRead(config.rpcUrl);
    if (registration.onChain) {
      markCtRegisteredLocally(smartAccount, config.confidentialTokenId);
    }
    const spendable = state.spendable.v;
    const receiving = state.receiving.v;
    return {
      registered: true,
      spendable,
      receiving,
      total: spendable + receiving,
      spendableSynced: verified.spendableOk,
      receivingSynced: verified.receivingOk,
      synced: verified.ok,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      registered: true,
      spendable: 0n,
      receiving: 0n,
      total: 0n,
      spendableSynced: false,
      receivingSynced: false,
      synced: false,
      syncError: message,
    };
  }
}

export function formatConfidentialAmount(raw: bigint, decimals = 7): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const body = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${body}` : body;
}
