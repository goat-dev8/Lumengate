const STORAGE_KEY = 'lumengate.passkey.v1';

export type StoredPasskey = {
  credentialId: string;
  publicKeyHex: string;
  keyDataHex: string;
  rpId: string;
  createdAt: number;
};

function rpId(): string {
  const configured = import.meta.env.VITE_PASSKEY_RP_ID;
  if (configured) return String(configured).trim();
  if (typeof window !== 'undefined') return window.location.hostname;
  return 'localhost';
}

function rpOrigin(): string {
  const configured = import.meta.env.VITE_PASSKEY_ORIGIN;
  if (configured) return String(configured).trim();
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:5173';
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}


export function loadStoredPasskey(): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPasskey;
  } catch {
    return null;
  }
}

export function saveStoredPasskey(passkey: StoredPasskey): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passkey));
}

export function clearStoredPasskey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!window.isSecureContext;
}

/** Create a secp256r1 passkey and persist locally for smart-account registration. */
export async function createPasskey(displayName: string): Promise<StoredPasskey> {
  if (!passkeySupported()) {
    throw new Error('Passkeys require HTTPS and a WebAuthn-capable browser.');
  }
  const id = rpId();
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Lumengate', id },
      user: {
        id: userId,
        name: displayName || 'lumengate-user',
        displayName: displayName || 'Lumengate user',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential || !(credential.response instanceof AuthenticatorAttestationResponse)) {
    throw new Error('Passkey creation failed');
  }

  const publicKeyBytes = credential.response.getPublicKey();
  if (!publicKeyBytes) throw new Error('Browser did not return passkey public key');

  const raw = new Uint8Array(publicKeyBytes);
  // Extract uncompressed P-256 point (0x04 || X || Y) from SPKI for Soroban webauthn verifier.
  const uncompressed = raw.slice(-65);
  if (uncompressed[0] !== 0x04 || uncompressed.length !== 65) {
    throw new Error('Unexpected passkey public key format');
  }

  const credentialIdHex = bufferToHex(credential.rawId);
  const publicKeyHex = bufferToHex(uncompressed.buffer);
  const keyDataHex = `${publicKeyHex}${credentialIdHex}`;

  const stored: StoredPasskey = {
    credentialId: credentialIdHex,
    publicKeyHex,
    keyDataHex,
    rpId: id,
    createdAt: Date.now(),
  };
  saveStoredPasskey(stored);
  return stored;
}

/** Sign the smart-account auth digest with the stored passkey (WebAuthn assertion). */
export async function signWithPasskey(authDigestHex: string): Promise<{
  authenticatorData: string;
  clientDataJson: string;
  signature: string;
}> {
  const stored = loadStoredPasskey();
  if (!stored) throw new Error('No passkey registered on this device');

  const digestBytes = Uint8Array.from(
    authDigestHex.replace(/^0x/i, '').match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
  );
  if (digestBytes.length !== 32) throw new Error('Auth digest must be 32 bytes');

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: digestBytes,
      rpId: stored.rpId,
      allowCredentials: [
        {
          type: 'public-key',
          id: Uint8Array.from(stored.credentialId.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []),
        },
      ],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion || !(assertion.response instanceof AuthenticatorAssertionResponse)) {
    throw new Error('Passkey assertion failed');
  }

  return {
    authenticatorData: bufferToHex(assertion.response.authenticatorData),
    clientDataJson: new TextDecoder().decode(assertion.response.clientDataJSON),
    signature: bufferToHex(assertion.response.signature),
  };
}

export function passkeyEnvSummary(): { rpId: string; origin: string; supported: boolean } {
  return { rpId: rpId(), origin: rpOrigin(), supported: passkeySupported() };
}
