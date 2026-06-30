import type { DeploymentConfig } from './config';
import { getOrCreateCtKeys } from './confidentialFlow';
import { ChainClient } from './confidentialToken/chain/client';
import { IndexerClient } from './confidentialToken/chain/indexer';
import { LocalStorageStore } from './confidentialToken/state/browser-store';
import { StateEngine } from './confidentialToken/state/engine';
import { readCtRegistered } from './confidentialSettlement';

export type ConfidentialEurcBalance = {
  registered: boolean;
  spendable: bigint;
  receiving: bigint;
  total: bigint;
  synced: boolean;
};

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

function ctIndexer(config: DeploymentConfig): IndexerClient | undefined {
  return config.confidentialIndexerUrl
    ? new IndexerClient({ baseUrl: config.confidentialIndexerUrl })
    : undefined;
}

export async function createConfidentialEurcStateEngine(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<StateEngine> {
  const keys = getOrCreateCtKeys(config, smartAccount);
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
  const registered = await readCtRegistered(config, smartAccount);
  if (!registered || !config.confidentialTokenId) {
    return { registered: false, spendable: 0n, receiving: 0n, total: 0n, synced: true };
  }
  const engine = await createConfidentialEurcStateEngine(config, smartAccount);
  const state = await engine.sync();
  const verified = await engine.verifyAgainstChain();
  const spendable = state.spendable.v;
  const receiving = state.receiving.v;
  return {
    registered: state.registered || registered,
    spendable,
    receiving,
    total: spendable + receiving,
    synced: verified.ok,
  };
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
