import type { DeploymentConfig } from './config';
import { getOrCreateCtKeys } from './confidentialFlow';
import { ChainClient } from './confidentialToken/chain/client';
import { LocalStorageStore } from './confidentialToken/state/browser-store';
import { StateEngine } from './confidentialToken/state/engine';
import { readCtRegistered } from './confidentialSettlement';

export type ConfidentialEurcBalance = {
  registered: boolean;
  spendable: bigint;
  receiving: bigint;
  total: bigint;
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

export async function readConfidentialEurcBalance(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<ConfidentialEurcBalance> {
  const registered = await readCtRegistered(config, smartAccount);
  if (!registered || !config.confidentialTokenId) {
    return { registered: false, spendable: 0n, receiving: 0n, total: 0n };
  }
  const keys = getOrCreateCtKeys(config, smartAccount);
  const client = ctChainClient(config);
  const fromLedger = Math.max(
    0,
    config.confidentialDeployedAtLedger ?? (await client.latestLedger()) - 50_000,
  );
  const engine = new StateEngine({
    client,
    store: new LocalStorageStore(`lumengate:ct:state:${config.confidentialTokenId}:`),
    keys,
    address: smartAccount,
    fromLedger,
  });
  const state = await engine.sync();
  const spendable = state.spendable.v;
  const receiving = state.receiving.v;
  return {
    registered: state.registered || registered,
    spendable,
    receiving,
    total: spendable + receiving,
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
