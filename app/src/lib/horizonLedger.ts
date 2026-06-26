import type { DeploymentConfig } from './config';

export async function fetchLatestLedger(config: DeploymentConfig): Promise<number | null> {
  try {
    const url = `${config.horizonUrl.replace(/\/$/, '')}/ledgers?order=desc&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      _embedded?: { records?: Array<{ sequence: number | string }> };
    };
    const seq = json._embedded?.records?.[0]?.sequence;
    if (seq === undefined) return null;
    return typeof seq === 'string' ? Number.parseInt(seq, 10) : seq;
  } catch {
    return null;
  }
}
