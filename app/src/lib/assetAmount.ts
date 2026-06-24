/** Parse a human decimal amount into stroops (7 decimals for USDC/EURC on Stellar). */
export function parseStellarAmount(amount: string, decimals = 7): bigint {
  const trimmed = amount.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Enter a valid amount.');
  }
  const [whole, frac = ''] = trimmed.split('.');
  if (frac.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }
  const padded = frac.padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

export function formatStellarAmount(raw: bigint, decimals = 7): string {
  if (raw < 0n) return '0';
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function hasSufficientBalance(balanceRaw: bigint, amountRaw: bigint): boolean {
  return balanceRaw >= amountRaw && amountRaw > 0n;
}
