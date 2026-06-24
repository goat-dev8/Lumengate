import { hash } from '@stellar/stellar-sdk';

/** Colons + Date.now() + Math.random() — measured worst case ≈39 bytes in browser. */
export const PASSKEY_USER_HANDLE_SUFFIX_RESERVE = 39;

/** smart-account-kit: `${userName}:${timestamp}:${Math.random()}` (decoded WebAuthn user.id). */
export function buildPasskeyRegistrationUserHandle(
  userName: string,
  nowMs = Date.now(),
  random = Math.random(),
): string {
  return `${userName}:${nowMs}:${random}`;
}

/** Short deterministic id; must stay ≤64 bytes once the kit appends timestamp and random. */
export function passkeyUserName(walletAddress: string): string {
  const maxLen = 64 - PASSKEY_USER_HANDLE_SUFFIX_RESERVE;
  return hash(Buffer.from(walletAddress)).toString('hex').slice(0, maxLen);
}

export function assertPasskeyUserNameBudget(userName: string): void {
  const worst = buildPasskeyRegistrationUserHandle(userName, 9_999_999_999_999, 0.123456789012345678);
  if (worst.length > 64) {
    throw new Error(`Passkey user handle exceeds 64 bytes (${worst.length})`);
  }
}
