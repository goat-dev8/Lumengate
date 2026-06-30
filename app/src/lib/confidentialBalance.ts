import type { DeploymentConfig } from './config';
import {
  resolveConfidentialAsset,
  withConfidentialContracts,
  type ConfidentialAssetKey,
} from './confidentialAssetConfig';
import { resolveCtKeys } from './confidentialFlow';
import { ChainClient } from './confidentialToken/chain/client';
import { IndexerClient } from './confidentialToken/chain/indexer';
import { IssuerCtIndexerClient } from './confidentialToken/chain/issuer-indexer';
import { LocalStorageStore } from './confidentialToken/state/browser-store';
import { StateEngine } from './confidentialToken/state/engine';
import { reviveState } from './confidentialToken/state/store';
import { readCtRegistrationStatus, markCtRegisteredLocally, isCtRegisteredLocally } from './ctRegistration';

export type ConfidentialAssetBalance = {
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

/** @deprecated Use ConfidentialAssetBalance */
export type ConfidentialEurcBalance = ConfidentialAssetBalance;

function ctConfigForAsset(config: DeploymentConfig, assetKey: ConfidentialAssetKey): DeploymentConfig {
  const asset = resolveConfidentialAsset(config, assetKey);
  if (!asset.contracts) {
    throw new Error(`${asset.label} confidential token is not configured.`);
  }
  return withConfidentialContracts(config, asset);
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
function ctIndexer(config: DeploymentConfig, assetKey: ConfidentialAssetKey): CtHistoryIndexer | undefined {
  const issuerBase = config.issuerServiceUrl?.replace(/\/$/, '');
  const configured = config.confidentialIndexerUrl?.replace(/\/$/, '');

  if (configured && issuerBase && (configured === `${issuerBase}/ct` || configured.endsWith('/ct'))) {
    return new IssuerCtIndexerClient({ baseUrl: issuerBase, assetKey });
  }
  if (configured && !configured.endsWith('/ct')) {
    return new IndexerClient({ baseUrl: configured });
  }
  if (issuerBase) {
    return new IssuerCtIndexerClient({ baseUrl: issuerBase, assetKey });
  }
  return undefined;
}

export function readCachedConfidentialAssetBalance(
  config: DeploymentConfig,
  smartAccount: string,
  assetKey: ConfidentialAssetKey,
): ConfidentialAssetBalance | null {
  const asset = resolveConfidentialAsset(config, assetKey);
  if (!asset.contracts || typeof localStorage === 'undefined') return null;
  const tokenId = asset.contracts.token;
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

/** @deprecated Use readCachedConfidentialAssetBalance(config, account, 'eurc') */
export function readCachedConfidentialEurcBalance(
  config: DeploymentConfig,
  smartAccount: string,
): ConfidentialAssetBalance | null {
  return readCachedConfidentialAssetBalance(config, smartAccount, 'eurc');
}

/** Authoritative cold-start initialization after CT register (demo wallet.refresh baseline). */
export async function initializeCtStateFromEvents(
  config: DeploymentConfig,
  smartAccount: string,
  assetKey: ConfidentialAssetKey = 'eurc',
): Promise<void> {
  const engine = await createConfidentialAssetStateEngine(config, smartAccount, assetKey);
  await engine.rebuildFromEvents();
  await engine.verifyAgainstChain();
}

export async function createConfidentialAssetStateEngine(
  config: DeploymentConfig,
  smartAccount: string,
  assetKey: ConfidentialAssetKey,
): Promise<StateEngine> {
  const scoped = ctConfigForAsset(config, assetKey);
  const keys = await resolveCtKeys(scoped, smartAccount);
  const client = ctChainClient(scoped);
  const fromLedger = Math.max(
    0,
    scoped.confidentialDeployedAtLedger ?? (await client.latestLedger()) - 50_000,
  );
  return new StateEngine({
    client,
    store: new LocalStorageStore(`lumengate:ct:state:${scoped.confidentialTokenId}:`),
    keys,
    address: smartAccount,
    fromLedger,
    indexer: ctIndexer(scoped, assetKey),
  });
}

/** @deprecated Use createConfidentialAssetStateEngine */
export async function createConfidentialEurcStateEngine(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<StateEngine> {
  return createConfidentialAssetStateEngine(config, smartAccount, 'eurc');
}

export async function readConfidentialAssetBalance(
  config: DeploymentConfig,
  smartAccount: string,
  assetKey: ConfidentialAssetKey,
): Promise<ConfidentialAssetBalance> {
  const scoped = ctConfigForAsset(config, assetKey);
  const registration = await readCtRegistrationStatus(scoped, smartAccount);
  if (!registration.registered || !scoped.confidentialTokenId) {
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
    const engine = await createConfidentialAssetStateEngine(config, smartAccount, assetKey);
    const { state, verified } = await engine.reconcileForRead(config.rpcUrl);
    if (registration.onChain) {
      markCtRegisteredLocally(smartAccount, scoped.confidentialTokenId);
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

/** @deprecated Use readConfidentialAssetBalance(config, account, 'eurc') */
export async function readConfidentialEurcBalance(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<ConfidentialAssetBalance> {
  return readConfidentialAssetBalance(config, smartAccount, 'eurc');
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
