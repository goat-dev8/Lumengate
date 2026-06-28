import type { DisclosurePack } from './disclosure';

export type StoredDisclosureResponse = {
  ok: boolean;
  stored: DisclosurePack & { auditorId: number; viewingKeyHash: string; storedAt?: number };
};

export type DisclosureQueryResponse = {
  auditorId: number;
  txHash: string | null;
  count: number;
  disclosures: DisclosurePack[];
  authMethod?: 'capability_token' | 'auditor_registry';
};

export async function storeDisclosurePack(
  issuerServiceUrl: string,
  viewingKey: string,
  auditorId: number,
  pack: DisclosurePack,
): Promise<StoredDisclosureResponse> {
  const res = await fetch(`${issuerServiceUrl.replace(/\/$/, '')}/disclose/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewingKey, auditorId, pack }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Disclosure store failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function queryDisclosures(
  issuerServiceUrl: string,
  viewingKey: string,
  auditorId: number,
  txHash?: string,
): Promise<DisclosureQueryResponse> {
  const res = await fetch(`${issuerServiceUrl.replace(/\/$/, '')}/disclose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewingKey, auditorId, txHash }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Disclosure query failed (${res.status}): ${text}`);
  }
  return res.json();
}
