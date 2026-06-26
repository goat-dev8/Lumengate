import type { ActivityEntry } from './activity';

export function formatHeroPortfolio(
  usdcBalance: string | null,
  rwaBalance: string | null,
): { main: string; sub?: string } {
  const usdc = usdcBalance ? Number.parseFloat(usdcBalance) : 0;
  const rwa = rwaBalance ? BigInt(rwaBalance) : 0n;

  if (usdc > 0 && rwa > 0n) {
    return {
      main: `$${usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      sub: `${rwa.toString()} treasury units on-chain`,
    };
  }
  if (usdc > 0) {
    return {
      main: `$${usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    };
  }
  if (rwa > 0n) {
    return {
      main: rwa.toString(),
      sub: 'Treasury units on-chain',
    };
  }
  return { main: '—' };
}

export function sumSettledFromActivity(activity: ActivityEntry[]): number {
  let sum = 0;
  for (const entry of activity) {
    if (entry.kind !== 'transfer' || entry.status !== 'success') continue;
    const fromTitle = entry.title.match(/(?:USDC|EURC) settlement:\s*([\d.]+)/i);
    const fromDetail = entry.detail.match(/^([\d.]+)\s+(?:USDC|EURC)/i);
    const match = fromTitle ?? fromDetail;
    if (match) sum += Number.parseFloat(match[1]);
  }
  return sum;
}

export function formatSettledLabel(activity: ActivityEntry[]): string | null {
  const total = sumSettledFromActivity(activity);
  if (total <= 0) return null;
  return `+$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} settled`;
}
