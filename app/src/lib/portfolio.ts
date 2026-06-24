import type { ActivityEntry } from './activity';

export type AllocationSlice = {
  label: string;
  value: number;
  color: string;
};

const COLORS = ['#0d9488', '#4f46e5', '#d97706', '#007dfc', '#dc2626'];

/** Derive allocation only from recorded settlement activity — never synthetic splits. */
export function allocationFromActivity(
  activity: ActivityEntry[],
  totalBalance: bigint,
): AllocationSlice[] {
  const byOffering = new Map<string, bigint>();

  for (const entry of activity) {
    if (entry.kind !== 'transfer' || entry.status !== 'success') continue;
    const match = entry.title.match(/^Settlement: (.+)$/);
    if (!match) continue;
    const label = match[1];
    const amountMatch = entry.detail.match(/^(\d+)/);
    const amount = amountMatch ? BigInt(amountMatch[1]) : 0n;
    if (amount <= 0n) continue;
    byOffering.set(label, (byOffering.get(label) ?? 0n) + amount);
  }

  if (byOffering.size === 0) {
    if (totalBalance > 0n) {
      return [{ label: 'RwaToken (on-chain)', value: Number(totalBalance), color: COLORS[0] }];
    }
    return [];
  }

  let i = 0;
  return [...byOffering.entries()].map(([label, amount]) => ({
    label,
    value: Number(amount),
    color: COLORS[i++ % COLORS.length],
  }));
}
