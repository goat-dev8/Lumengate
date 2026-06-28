import type { DisclosurePack } from './disclosure';

/** Read-only disclosure capability token — not a wallet, passkey, or spending key. */
export type ViewingKeyPurpose = 'selective_disclosure';

export type AuditorPackage = {
  version: 1;
  type: 'lumengate-auditor-package';
  generatedAt: number;
  auditorId: number;
  viewingKey: string;
  purpose: ViewingKeyPurpose;
  disclosure: DisclosurePack;
  network: string;
  instructions: string;
};

const VIEWING_KEY_STORAGE_PREFIX = 'lumengate.viewingKey.v1';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Cryptographically random 256-bit viewing key (SHA-256 hashed on issuer for lookup). */
export function generateViewingKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `lgvk_${bytesToBase64Url(bytes)}`;
}

export async function hashViewingKey(viewingKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(viewingKey);
  const data = new Uint8Array(encoded);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildAuditorPackage(input: {
  viewingKey: string;
  auditorId: number;
  disclosure: DisclosurePack;
  network: string;
}): AuditorPackage {
  return {
    version: 1,
    type: 'lumengate-auditor-package',
    generatedAt: Date.now(),
    auditorId: input.auditorId,
    viewingKey: input.viewingKey,
    purpose: 'selective_disclosure',
    disclosure: input.disclosure,
    network: input.network,
    instructions:
      'Share this package with your auditor. They enter the viewing key in the Lumengate Auditor Portal to verify eligibility claims and settlement references. The key is read-only and cannot move funds.',
  };
}

export function auditorPackageFilename(walletAddress: string): string {
  return `lumengate-auditor-package-${walletAddress.slice(0, 8)}.json`;
}

export function persistViewingKeyForReceipt(txHash: string, viewingKey: string): void {
  try {
    localStorage.setItem(`${VIEWING_KEY_STORAGE_PREFIX}.${txHash}`, viewingKey);
  } catch {
    /* ignore quota */
  }
}

export function loadViewingKeyForReceipt(txHash: string): string | null {
  try {
    return localStorage.getItem(`${VIEWING_KEY_STORAGE_PREFIX}.${txHash}`);
  } catch {
    return null;
  }
}
