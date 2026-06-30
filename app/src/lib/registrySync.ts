import type { DeploymentConfig, IssuerCredentialResponse } from './config';
import { fetchIssuerRoots, fetchRegistrySyncRoot } from './config';
import type { ProofBundle } from './contracts';
import { credentialRootMatchesChain, readOnChainRoots } from './contracts';
import { proofMatchesCredential } from './credentialProof';
import { verifyPublicInputsMatchRoots } from './prover';

function rootHexFromCredential(credential: IssuerCredentialResponse): string {
  const raw = credential.credential.root;
  if (String(raw).startsWith('0x')) return String(raw);
  return `0x${BigInt(String(raw)).toString(16).padStart(64, '0')}`;
}

/** Wait until on-chain registry matches this passport (or an existing proof’s public inputs). */
export async function waitForCredentialRootsReady(
  config: DeploymentConfig,
  credential: IssuerCredentialResponse,
  existingProof?: ProofBundle | null,
  onProgress?: (message: string) => void,
): Promise<boolean> {
  const credentialRoot = rootHexFromCredential(credential);
  if (await credentialRootMatchesChain(config, credentialRoot, 2, 500)) {
    return true;
  }

  if (existingProof && proofMatchesCredential(existingProof, credential)) {
    if (await chainMatchesProofWithConfig(config, existingProof)) {
      return true;
    }
  }

  const attempts = 12;
  const intervalMs = 2500;
  for (let i = 0; i < attempts; i += 1) {
    onProgress?.(`Syncing eligibility registry on-chain (${i + 1}/${attempts})…`);
    if (await credentialRootMatchesChain(config, credentialRoot, 1, 0)) {
      return true;
    }
    if (existingProof && proofMatchesCredential(existingProof, credential)) {
      if (await chainMatchesProofWithConfig(config, existingProof)) {
        return true;
      }
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}

async function chainMatchesProofWithConfig(
  config: DeploymentConfig,
  proof: ProofBundle,
): Promise<boolean> {
  try {
    const onChain = await readOnChainRoots(config);
    return verifyPublicInputsMatchRoots(proof, onChain);
  } catch {
    return false;
  }
}

export type RegistrySyncResult = {
  root: string;
  synced: boolean;
};

/** Ask issuer to re-assert this wallet’s eligibility root on-chain (no new note secret). */
export async function ensureRegistryRootForWallet(
  issuerServiceUrl: string,
  walletField: string,
  policyKey: string,
): Promise<RegistrySyncResult | null> {
  try {
    const result = await fetchRegistrySyncRoot(issuerServiceUrl, walletField, policyKey);
    return { root: result.root, synced: result.synced };
  } catch (primaryErr) {
    const message = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    const missingSyncRoute = message.includes('sync-root failed (404)');
    if (!missingSyncRoute) {
      throw primaryErr;
    }
  }

  const roots = await fetchIssuerRoots(issuerServiceUrl, {
    walletField,
    policyKey,
    sync: true,
  });
  return { root: roots.root, synced: true };
}

export function registryRootMismatchMessage(): string {
  return (
    'Eligibility registry does not match your passport yet. ' +
    'Wait a few seconds and try Send again, or go to Verify → Request new passport if it persists.'
  );
}

/** Sync issuer root on-chain and poll until credential roots match (auto-retries once). */
export async function ensureCredentialRootsReady(
  config: DeploymentConfig,
  credential: IssuerCredentialResponse,
  options: {
    walletField?: string;
    policyKey: string;
    issuerServiceUrl: string;
    existingProof?: ProofBundle | null;
    onProgress?: (message: string) => void;
  },
): Promise<{ ready: boolean; credential: IssuerCredentialResponse }> {
  let activeCredential = credential;
  const { walletField, policyKey, issuerServiceUrl, existingProof, onProgress } = options;

  const syncRoot = async () => {
    if (!walletField) return;
    onProgress?.('Confirming eligibility registry on-chain…');
    const syncResult = await ensureRegistryRootForWallet(issuerServiceUrl, walletField, policyKey).catch(
      () => null,
    );
    if (syncResult?.root) {
      activeCredential = {
        ...activeCredential,
        credential: { ...activeCredential.credential, root: syncResult.root },
      };
    }
  };

  for (let round = 0; round < 2; round += 1) {
    if (round > 0) {
      onProgress?.('Refreshing eligibility registry…');
    }
    await syncRoot();
    await new Promise((resolve) => setTimeout(resolve, round === 0 ? 3500 : 2500));
    const ready = await waitForCredentialRootsReady(config, activeCredential, existingProof, onProgress);
    if (ready) {
      return { ready: true, credential: activeCredential };
    }
  }

  return { ready: false, credential: activeCredential };
}
