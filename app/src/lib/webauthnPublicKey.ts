import { p256 } from '@noble/curves/nist.js';
import { bytesToHex } from '@noble/curves/utils.js';
import base64url from 'base64url';

const ATTESTED_CREDENTIAL_DATA_FLAG = 0x40;
const SECP256R1_PUBLIC_KEY_SIZE = 65;
const UNCOMPRESSED_POINT_PREFIX = 0x04;

type CborValue = number | string | Uint8Array | Map<CborValue, CborValue> | CborValue[] | boolean | null;

type DecodeResult = {
  value: CborValue;
  offset: number;
};

function readLength(data: Uint8Array, offset: number, additional: number): { length: number; offset: number } {
  if (additional < 24) return { length: additional, offset };
  if (additional === 24) return { length: data[offset], offset: offset + 1 };
  if (additional === 25) return { length: (data[offset] << 8) | data[offset + 1], offset: offset + 2 };
  if (additional === 26) {
    return {
      length: (data[offset] * 0x1000000) + ((data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]),
      offset: offset + 4,
    };
  }
  throw new Error('Unsupported CBOR length encoding');
}

function decodeCborValue(data: Uint8Array, startOffset = 0): DecodeResult {
  const initial = data[startOffset];
  const major = initial >> 5;
  const additional = initial & 0x1f;
  let offset = startOffset + 1;

  if (major === 0 || major === 1) {
    const len = readLength(data, offset, additional);
    offset = len.offset;
    return { value: major === 0 ? len.length : -1 - len.length, offset };
  }

  if (major === 2 || major === 3) {
    const len = readLength(data, offset, additional);
    offset = len.offset;
    const end = offset + len.length;
    if (end > data.length) throw new Error('Truncated CBOR byte/string value');
    const bytes = data.slice(offset, end);
    return {
      value: major === 2 ? bytes : new TextDecoder().decode(bytes),
      offset: end,
    };
  }

  if (major === 4) {
    const len = readLength(data, offset, additional);
    offset = len.offset;
    const values: CborValue[] = [];
    for (let i = 0; i < len.length; i += 1) {
      const decoded = decodeCborValue(data, offset);
      values.push(decoded.value);
      offset = decoded.offset;
    }
    return { value: values, offset };
  }

  if (major === 5) {
    const len = readLength(data, offset, additional);
    offset = len.offset;
    const map = new Map<CborValue, CborValue>();
    for (let i = 0; i < len.length; i += 1) {
      const key = decodeCborValue(data, offset);
      offset = key.offset;
      const value = decodeCborValue(data, offset);
      offset = value.offset;
      map.set(key.value, value.value);
    }
    return { value: map, offset };
  }

  if (major === 6) {
    const len = readLength(data, offset, additional);
    return decodeCborValue(data, len.offset);
  }

  if (major === 7) {
    if (additional === 20) return { value: false, offset };
    if (additional === 21) return { value: true, offset };
    if (additional === 22) return { value: null, offset };
  }

  throw new Error('Unsupported CBOR value');
}

function assertSecp256r1Point(publicKey: Uint8Array): Uint8Array {
  if (publicKey.length !== SECP256R1_PUBLIC_KEY_SIZE || publicKey[0] !== UNCOMPRESSED_POINT_PREFIX) {
    throw new Error('Invalid P-256 public key format');
  }
  p256.Point.fromHex(bytesToHex(publicKey));
  return publicKey;
}

function coseKeyToSecp256r1PublicKey(coseKey: Uint8Array): Uint8Array {
  const decoded = decodeCborValue(coseKey).value;
  if (!(decoded instanceof Map)) {
    throw new Error('COSE public key is not a map');
  }

  const alg = decoded.get(3);
  const keyType = decoded.get(1);
  const curve = decoded.get(-1);
  const x = decoded.get(-2);
  const y = decoded.get(-3);

  if (alg !== -7 || keyType !== 2 || curve !== 1) {
    throw new Error('Passkey is not an ES256 P-256 credential');
  }
  if (!(x instanceof Uint8Array) || x.length !== 32 || !(y instanceof Uint8Array) || y.length !== 32) {
    throw new Error('Invalid COSE P-256 coordinates');
  }

  return assertSecp256r1Point(new Uint8Array([UNCOMPRESSED_POINT_PREFIX, ...x, ...y]));
}

function extractPublicKeyFromAuthData(authData: Uint8Array): Uint8Array {
  const attestedCredentialOffset = 32 + 1 + 4;
  const flags = authData[32];
  if ((flags & ATTESTED_CREDENTIAL_DATA_FLAG) === 0) {
    throw new Error('Authenticator data does not include attested credential data');
  }
  if (authData.length < attestedCredentialOffset + 16 + 2) {
    throw new Error('Authenticator data is too short');
  }

  const credentialIdLengthOffset = attestedCredentialOffset + 16;
  const credentialIdLength =
    (authData[credentialIdLengthOffset] << 8) | authData[credentialIdLengthOffset + 1];
  const coseKeyOffset = credentialIdLengthOffset + 2 + credentialIdLength;
  if (coseKeyOffset >= authData.length) {
    throw new Error('Authenticator data is missing COSE public key');
  }

  return coseKeyToSecp256r1PublicKey(authData.slice(coseKeyOffset));
}

function extractPublicKeyFromAttestationObject(attestationObject: Uint8Array): Uint8Array {
  const decoded = decodeCborValue(attestationObject).value;
  if (!(decoded instanceof Map)) {
    throw new Error('Attestation object is not a CBOR map');
  }
  const authData = decoded.get('authData');
  if (!(authData instanceof Uint8Array)) {
    throw new Error('Attestation object is missing authData');
  }
  return extractPublicKeyFromAuthData(authData);
}

export function extractRegistrationPublicKey(response: {
  publicKey?: string;
  authenticatorData?: string;
  attestationObject?: string;
}): Uint8Array {
  if (response.publicKey) {
    const publicKey = base64url.toBuffer(response.publicKey);
    const sec1 = publicKey.slice(publicKey.length - SECP256R1_PUBLIC_KEY_SIZE);
    try {
      return assertSecp256r1Point(sec1);
    } catch {
      // Fall through to the canonical attested COSE key below.
    }
  }

  if (response.authenticatorData) {
    return extractPublicKeyFromAuthData(base64url.toBuffer(response.authenticatorData));
  }

  if (response.attestationObject) {
    return extractPublicKeyFromAttestationObject(base64url.toBuffer(response.attestationObject));
  }

  throw new Error('Could not extract passkey public key from registration response');
}
