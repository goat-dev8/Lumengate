const STORAGE_KEY = 'lumengate-advanced-mode';

export function readAdvancedMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function writeAdvancedMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

export function friendlyIssuerError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('nargo: not found') || lower.includes('failed to build prover inputs')) {
    return 'Passport service is temporarily unavailable. Our team has been notified — please retry in a minute.';
  }
  if (lower.includes('cannot sync credential root') || lower.includes('sync credential root')) {
    return 'Issuer could not sync the eligibility registry. Retry in ~30 seconds or choose General RWA eligibility.';
  }
  if (lower.includes('on-chain roots') || lower.includes('merkle root') || lower.includes('does not match credential root')) {
    return 'Compliance registry is syncing. Wait ~30 seconds and try again.';
  }
  if (lower.includes('eligibility registry does not match')) {
    return raw;
  }
  if (lower.includes('503') || lower.includes('502') || lower.includes('520')) {
    return 'Passport service is waking up (hosted issuer). Wait ~30 seconds and retry.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Could not reach the issuer service. Check your connection and try again.';
  }
  if (lower.includes('cors')) {
    return 'Browser blocked the request. Refresh the page and try again.';
  }
  return raw.replace(/^\/credential failed \(\d+\):\s*/i, '').trim() || raw;
}
