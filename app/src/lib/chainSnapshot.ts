import { loadDeploymentConfig, fetchIssuerHealth } from './config';
import { readOnChainRoots, readBalance, readIsFrozen } from './contracts';
import { loadActivity, type ActivityKind } from './activity';

export type ReferenceTx = {
  label: string;
  hash: string;
};

export type ChainSnapshot = {
  issuerOk: boolean;
  issuerLabel: string;
  issuerHint: string | null;
  roots: { root: string; revocationRoot: string } | null;
  balance: string | null;
  frozen: boolean | null;
  policyId: number;
  sessionEvents: number;
  referenceTxs: ReferenceTx[];
  network: string;
};

export function referenceTxsFromActivity(): ReferenceTx[] {
  const kindLabels: Record<ActivityKind, string> = {
    verify: 'BN254 verify',
    transfer: 'Eligible transfer',
    freeze_check: 'Freeze enforcement',
    credential: 'Credential issued',
    proof: 'Proof generated',
  };
  const seen = new Set<string>();
  const rows: ReferenceTx[] = [];
  for (const entry of loadActivity()) {
    if (!entry.txHash || seen.has(entry.txHash)) continue;
    seen.add(entry.txHash);
    rows.push({
      label: kindLabels[entry.kind] || entry.title,
      hash: entry.txHash,
    });
  }
  return rows;
}

/** Baseline on-chain txs from deployment (real testnet hashes, not simulated). */
export function referenceTxsFromDeployment(): ReferenceTx[] {
  const rows: ReferenceTx[] = [];
  const verify =
    import.meta.env.VITE_REFERENCE_VERIFY_TX || import.meta.env.VITE_DEMO_VERIFY_TX;
  const transfer =
    import.meta.env.VITE_REFERENCE_TRANSFER_TX || import.meta.env.VITE_DEMO_TRANSFER_TX;
  const freeze =
    import.meta.env.VITE_REFERENCE_FREEZE_TX || import.meta.env.VITE_DEMO_FREEZE_TX;
  if (verify) rows.push({ label: 'BN254 verify', hash: String(verify) });
  if (transfer) rows.push({ label: 'Eligible transfer', hash: String(transfer) });
  if (freeze) rows.push({ label: 'Freeze enforcement', hash: String(freeze) });
  return rows;
}

export function mergeReferenceTxs(primary: ReferenceTx[], fallback: ReferenceTx[]): ReferenceTx[] {
  const seen = new Set(primary.map((row) => row.hash));
  const merged = [...primary];
  for (const row of fallback) {
    if (seen.has(row.hash)) continue;
    seen.add(row.hash);
    merged.push(row);
  }
  return merged;
}

export async function fetchChainSnapshot(walletAddress: string | null): Promise<ChainSnapshot> {
  const config = loadDeploymentConfig();
  const referenceTxs = mergeReferenceTxs(
    referenceTxsFromActivity(),
    referenceTxsFromDeployment(),
  );
  const sessionEvents = loadActivity().length;

  let issuerOk = false;
  let issuerLabel = 'Offline';
  let issuerHint: string | null = null;
  let roots: ChainSnapshot['roots'] = null;
  let balance: string | null = null;
  let frozen: boolean | null = null;

  try {
    const health = await fetchIssuerHealth(config.issuerServiceUrl);
    issuerOk = Boolean(health.ok);
    issuerLabel = health.issuer ? truncateAddr(health.issuer) : 'Issuer online';
  } catch (e) {
    issuerHint =
      e instanceof Error
        ? e.message
        : 'Start issuer service: cd issuer-service && npm start';
  }

  try {
    roots = await readOnChainRoots(config);
  } catch {
    /* chain reads optional for landing preview */
  }

  if (walletAddress) {
    try {
      balance = await readBalance(config, walletAddress);
      frozen = await readIsFrozen(config, walletAddress);
    } catch {
      /* wallet reads require funded account */
    }
  }

  return {
    issuerOk,
    issuerLabel,
    issuerHint,
    roots,
    balance,
    frozen,
    policyId: config.policyId,
    sessionEvents,
    referenceTxs,
    network: config.network,
  };
}

function truncateAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}
