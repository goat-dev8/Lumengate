import { loadPasskeySession } from './passkeySession';

/** Logo / brand click target: app home when a session exists, marketing landing otherwise. */
export function getBrandHomeHref(settlementAddress?: string | null): string {
  if (settlementAddress) return '/app/home';
  if (loadPasskeySession()?.smartAccountAddress) return '/app/home';
  return '/';
}
