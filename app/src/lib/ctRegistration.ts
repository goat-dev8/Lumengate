import type { DeploymentConfig } from './config';
import { ChainClient } from './confidentialToken/chain/client';
import { withRetry } from './retry';

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

function localRegistrationKey(smartAccount: string, tokenId: string): string {
  return `lumengate:ct:registered:${tokenId}:${smartAccount}`;
}

export function markCtRegisteredLocally(smartAccount: string, tokenId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(localRegistrationKey(smartAccount, tokenId), String(Date.now()));
}

export function clearCtRegisteredLocally(smartAccount: string, tokenId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(localRegistrationKey(smartAccount, tokenId));
}

export function isCtRegisteredLocally(smartAccount: string, tokenId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(localRegistrationKey(smartAccount, tokenId)) !== null;
}

export async function readCtRegisteredOnChain(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<boolean> {
  if (!config.confidentialTokenId) return false;
  try {
    const client = ctChainClient(config);
    return await withRetry(() => client.isRegistered(smartAccount), {
      attempts: 4,
      baseDelayMs: 700,
      maxDelayMs: 4_000,
    });
  } catch {
    return false;
  }
}

function isCtRegisteredInStateStore(smartAccount: string, tokenId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(`lumengate:ct:state:${tokenId}:${smartAccount}`);
  if (!raw) return false;
  try {
    return Boolean((JSON.parse(raw) as { registered?: boolean }).registered);
  } catch {
    return false;
  }
}

export async function readCtRegistrationStatus(
  config: DeploymentConfig,
  smartAccount: string,
): Promise<{ onChain: boolean; local: boolean; registered: boolean }> {
  if (!config.confidentialTokenId) {
    return { onChain: false, local: false, registered: false };
  }
  const tokenId = config.confidentialTokenId;
  const local = isCtRegisteredLocally(smartAccount, tokenId);
  const stateRegistered = isCtRegisteredInStateStore(smartAccount, tokenId);
  const onChain = await readCtRegisteredOnChain(config, smartAccount);
  const registered = onChain || local || stateRegistered;
  if (onChain || stateRegistered) {
    markCtRegisteredLocally(smartAccount, tokenId);
  }
  return {
    onChain,
    local: local || stateRegistered || onChain,
    registered,
  };
}
