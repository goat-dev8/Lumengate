import type { IssuerCredentialResponse } from './config';

export function issuerStellarAddress(
  credential?: IssuerCredentialResponse | null,
): string | null {
  return (
    credential?.issuerStellarPublicKey ??
    credential?.credential?.stellarPublicKey ??
    credential?.issuerEthAddress ??
    null
  );
}

export function issuerDisplayLabel(credential?: IssuerCredentialResponse | null): string {
  const addr = issuerStellarAddress(credential);
  if (!addr) return 'Stellar issuer';
  if (addr.startsWith('G') && addr.length >= 10) {
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }
  return addr;
}
