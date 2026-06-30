import type { DeploymentConfig } from './config';

export type CtIndexedEvent = {
  id: string;
  ledger: number;
  txHash: string;
  type: string;
  account?: string;
  from?: string;
  to?: string;
  amount?: string;
  auditorId?: number;
  sigma?: string;
  rE?: { x: string; y: string };
  vTilde?: string;
  bTilde?: string;
  vAudR?: string;
  rAudR?: string;
  vAudS?: string;
  bAudS?: string;
};

export type CtEventsResponse = {
  events: CtIndexedEvent[];
  latestLedger: number;
  cursor: string | null;
};

function issuerBase(config: DeploymentConfig): string {
  const base = config.issuerServiceUrl?.replace(/\/$/, '');
  if (!base) throw new Error('Issuer service URL is not configured.');
  return base;
}

export async function fetchCtDeployments(config: DeploymentConfig): Promise<{
  network: string;
  deployment: Record<string, unknown>;
}> {
  const res = await fetch(`${issuerBase(config)}/ct/deployments`);
  if (!res.ok) throw new Error(`CT deployments unavailable (${res.status})`);
  return res.json();
}

export async function fetchCtEvents(
  config: DeploymentConfig,
  query?: { account?: string; fromLedger?: number },
): Promise<CtEventsResponse> {
  const params = new URLSearchParams();
  if (query?.account) params.set('account', query.account);
  if (query?.fromLedger) params.set('fromLedger', String(query.fromLedger));
  const qs = params.toString();
  const res = await fetch(`${issuerBase(config)}/ct/events${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`CT events unavailable (${res.status})`);
  return res.json();
}

export async function syncCtEvents(config: DeploymentConfig): Promise<{ ok: boolean; ingested: number }> {
  const res = await fetch(`${issuerBase(config)}/ct/sync`, { method: 'POST' });
  if (!res.ok) throw new Error(`CT sync failed (${res.status})`);
  return res.json();
}
