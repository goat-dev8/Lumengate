import { Address, hash, xdr } from '@stellar/stellar-sdk';
import base64url from 'base64url';
import { WEBAUTHN_TIMEOUT_MS } from 'smart-account-kit';
import type { SmartAccountKit } from 'smart-account-kit';
import type { Signer as ContractSigner } from 'smart-account-kit-bindings';
import { coerceKeyDataBuffer, externalSignerKeyDataEqual } from './onChainContextRules';

const SECP256R1_PUBLIC_KEY_SIZE = 65;

/** Stellar requires compact (r||s) secp256r1 signatures with low-S normalization. */
function compactSignature(derSignature: Buffer): Uint8Array {
  let offset = 2;
  const rLength = derSignature[offset + 1];
  const r = derSignature.slice(offset + 2, offset + 2 + rLength);
  offset += 2 + rLength;
  const sLength = derSignature[offset + 1];
  const s = derSignature.slice(offset + 2, offset + 2 + sLength);
  const rBigInt = BigInt(`0x${r.toString('hex')}`);
  let sBigInt = BigInt(`0x${s.toString('hex')}`);
  const n = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  if (sBigInt > n / 2n) {
    sBigInt = n - sBigInt;
  }
  const rPadded = Buffer.from(rBigInt.toString(16).padStart(64, '0'), 'hex');
  const sLowS = Buffer.from(sBigInt.toString(16).padStart(64, '0'), 'hex');
  return new Uint8Array(Buffer.concat([rPadded, sLowS]));
}

/** Match soroban-env-host `invocation_tree_to_auth_contexts`: one context per tree node. */
export function countAuthContextsInTree(invocation: xdr.SorobanAuthorizedInvocation): number {
  let count = 0;
  const walk = (inv: xdr.SorobanAuthorizedInvocation) => {
    count += 1;
    for (const sub of inv.subInvocations()) {
      walk(sub);
    }
  };
  walk(invocation);
  return Math.max(count, 1);
}

export function resolveDefaultContextRuleIds(
  invocation: xdr.SorobanAuthorizedInvocation,
  defaultRuleId = 0,
): number[] {
  return Array.from({ length: countAuthContextsInTree(invocation) }, () => defaultRuleId);
}

/** auth_digest = sha256(signature_payload || context_rule_ids.to_xdr()) per stellar-accounts 0.7.x */
export function computeAuthDigest(signaturePayload: Buffer, contextRuleIds: number[]): Buffer {
  const contextRuleIdsVal = xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id)));
  return hash(Buffer.concat([signaturePayload, contextRuleIdsVal.toXDR()]));
}

type AuthPayload = {
  context_rule_ids: number[];
  signers: Array<{ signer: ContractSigner; signatureBytes: Buffer }>;
};

function emptyAuthPayload(): AuthPayload {
  return { context_rule_ids: [], signers: [] };
}

function readAuthPayload(signature: xdr.ScVal): AuthPayload {
  if (signature.switch().name === 'scvVoid') {
    return emptyAuthPayload();
  }
  if (signature.switch().name !== 'scvMap') {
    throw new Error('Smart account auth signature is not encoded as AuthPayload');
  }

  const payload = emptyAuthPayload();
  for (const entry of signature.map() ?? []) {
    const key = entry.key();
    if (key.switch().name !== 'scvSymbol') continue;
    const field = key.sym().toString();
    if (field === 'context_rule_ids') {
      const value = entry.val();
      if (value.switch().name !== 'scvVec') {
        throw new Error('AuthPayload.context_rule_ids is not a vector');
      }
      payload.context_rule_ids = (value.vec() ?? []).map((item) => {
        if (item.switch().name !== 'scvU32') {
          throw new Error('AuthPayload.context_rule_ids contains a non-u32 value');
        }
        return item.u32();
      });
    }
    if (field === 'signers') {
      const value = entry.val();
      if (value.switch().name !== 'scvMap') {
        throw new Error('AuthPayload.signers is not a map');
      }
      for (const signerEntry of value.map() ?? []) {
        const signerValue = signerEntry.val();
        if (signerValue.switch().name !== 'scvBytes') {
          throw new Error('AuthPayload.signers contains a non-bytes signature value');
        }
        payload.signers.push({
          signer: parseSignerScVal(signerEntry.key()),
          signatureBytes: Buffer.from(signerValue.bytes()),
        });
      }
    }
  }
  return payload;
}

function writeAuthPayload(payload: AuthPayload): xdr.ScVal {
  const signerEntries = payload.signers.map(({ signer, signatureBytes }) => (
    new xdr.ScMapEntry({
      key: signerToScVal(signer),
      val: xdr.ScVal.scvBytes(signatureBytes),
    })
  ));
  signerEntries.sort((a, b) => a.key().toXDR('hex').localeCompare(b.key().toXDR('hex')));

  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('context_rule_ids'),
      val: xdr.ScVal.scvVec(payload.context_rule_ids.map((id) => xdr.ScVal.scvU32(id))),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('signers'),
      val: xdr.ScVal.scvMap(signerEntries),
    }),
  ]);
}

function buildWebAuthnSignatureBytes(
  sigData: { authenticator_data: Buffer; client_data: Buffer; signature: Buffer },
): Buffer {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('authenticator_data'),
      val: xdr.ScVal.scvBytes(sigData.authenticator_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('client_data'),
      val: xdr.ScVal.scvBytes(sigData.client_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('signature'),
      val: xdr.ScVal.scvBytes(sigData.signature),
    }),
  ]).toXDR();
}

function signerToScVal(signer: ContractSigner): xdr.ScVal {
  if (signer.tag === 'Delegated') {
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol('Delegated'),
      xdr.ScVal.scvAddress(Address.fromString(signer.values[0]).toScAddress()),
    ]);
  }

  const keyData = coerceKeyDataBuffer(signer.values[1]);
  if (!keyData) {
    throw new Error('External signer is missing passkey key_data bytes');
  }

  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('External'),
    xdr.ScVal.scvAddress(Address.fromString(signer.values[0]).toScAddress()),
    xdr.ScVal.scvBytes(keyData),
  ]);
}

function parseSignerScVal(value: xdr.ScVal): ContractSigner {
  if (value.switch().name !== 'scvVec') {
    throw new Error('Signer key is not encoded as a vector');
  }
  const items = value.vec() ?? [];
  if (items.length < 2 || items[0].switch().name !== 'scvSymbol') {
    throw new Error('Signer key is not a valid enum encoding');
  }

  const variant = items[0].sym().toString();
  if (variant === 'Delegated') {
    if (items[1].switch().name !== 'scvAddress') {
      throw new Error('Delegated signer is missing an address');
    }
    return {
      tag: 'Delegated',
      values: [Address.fromScAddress(items[1].address()).toString()],
    };
  }
  if (variant === 'External') {
    if (items.length < 3 || items[1].switch().name !== 'scvAddress' || items[2].switch().name !== 'scvBytes') {
      throw new Error('External signer is missing required verifier or key data');
    }
    return {
      tag: 'External',
      values: [Address.fromScAddress(items[1].address()).toString(), Buffer.from(items[2].bytes())],
    };
  }
  throw new Error(`Unknown signer variant: ${variant}`);
}

function upsertAuthPayloadSigner(payload: AuthPayload, signer: ContractSigner, signatureBytes: Buffer): void {
  const existing = payload.signers.findIndex((item) => signersEqual(item.signer, signer));
  if (existing >= 0) {
    payload.signers.splice(existing, 1);
  }
  payload.signers.push({ signer, signatureBytes });
}

function signersEqual(a: ContractSigner, b: ContractSigner): boolean {
  if (a.tag !== b.tag) return false;
  if (a.values[0] !== b.values[0]) return false;
  if (a.tag === 'External' && b.tag === 'External') {
    return externalSignerKeyDataEqual(a.values[1], b.values[1]);
  }
  return true;
}

async function resolveSigningExternalSigner(
  kit: SmartAccountKit,
  kitAny: PasskeyKitInternals,
  options: SignAuthEntryOptions | undefined,
  credentialIdBuffer: Buffer,
  entry: xdr.SorobanAuthorizationEntry,
): Promise<ContractSigner> {
  const verifier = kitAny.webauthnVerifierAddress;
  if (!verifier) {
    throw new Error('WebAuthn verifier is not configured.');
  }

  const pinned = kitAny._passkeyKeyData;
  const candidates: Array<Buffer | null | undefined> = [
    options?.signer?.tag === 'External' ? coerceKeyDataBuffer(options.signer.values[1]) : null,
    pinned,
  ];

  for (const candidate of candidates) {
    if (!candidate || candidate.length <= SECP256R1_PUBLIC_KEY_SIZE) continue;
    const suffix = candidate.slice(SECP256R1_PUBLIC_KEY_SIZE);
    if (suffix.equals(credentialIdBuffer)) {
      return { tag: 'External', values: [verifier, candidate] };
    }
  }

  try {
    const keyData = await findKeyDataByCredentialId(kit, credentialIdBuffer, entry);
    kitAny._passkeyKeyData = keyData;
    return { tag: 'External', values: [verifier, keyData] };
  } catch (err) {
    if (pinned && pinned.length > SECP256R1_PUBLIC_KEY_SIZE) {
      return { tag: 'External', values: [verifier, pinned] };
    }
    throw err;
  }
}

function readWebAuthnAssertionFields(response: {
  authenticatorData?: string;
  clientDataJSON?: string;
  signature?: string;
}): { authenticatorData: string; clientDataJSON: string; signature: string } {
  const { authenticatorData, clientDataJSON, signature } = response;
  if (!authenticatorData || !clientDataJSON || !signature) {
    throw new Error(
      'Passkey assertion is missing required fields (authenticatorData, clientDataJSON, or signature). Retry the send.',
    );
  }
  return { authenticatorData, clientDataJSON, signature };
}

async function findKeyDataByCredentialId(
  kit: SmartAccountKit,
  credentialId: Buffer,
  entry: xdr.SorobanAuthorizationEntry,
): Promise<Buffer> {
  const kitAny = kit as unknown as PasskeyKitInternals;
  const pinned = kitAny._passkeyKeyData;
  if (pinned && pinned.length > SECP256R1_PUBLIC_KEY_SIZE) {
    const suffix = pinned.slice(SECP256R1_PUBLIC_KEY_SIZE);
    if (suffix.equals(credentialId)) {
      return pinned;
    }
  }

  const wallet = kit.wallet as unknown as {
    get_context_rules?: (args: { context_rule_type: { tag: string; values?: unknown[] } }) => Promise<{
      result: Array<{ signers: Array<{ tag: string; values: [string, Buffer] }> }>;
    }>;
  };
  if (!wallet?.get_context_rules) {
    throw new Error('Smart account wallet is not connected.');
  }
  const contextRuleTypes = buildContextRuleTypes(entry);
  for (const contextRuleType of contextRuleTypes) {
    const rulesResult = await wallet.get_context_rules({ context_rule_type: contextRuleType });
    for (const rule of rulesResult.result) {
      for (const signer of rule.signers) {
        if (signer.tag === 'External') {
          const keyData = coerceKeyDataBuffer(signer.values[1]);
          if (!keyData || keyData.length <= SECP256R1_PUBLIC_KEY_SIZE) continue;
          const suffix = keyData.slice(SECP256R1_PUBLIC_KEY_SIZE);
          if (suffix.equals(credentialId)) {
            return keyData;
          }
        }
      }
    }
  }
  throw new Error(`No signer found for credential ID: ${credentialId.toString('base64')}`);
}

function buildContextRuleTypes(entry: xdr.SorobanAuthorizationEntry) {
  const types: Array<{ tag: string; values?: unknown[] }> = [];
  const seen = new Set<string>();
  const add = (type: { tag: string; values?: unknown[] }) => {
    let key: string;
    if (type.tag === 'Default') {
      key = 'Default';
    } else if (type.tag === 'CallContract') {
      key = `CallContract:${type.values?.[0]}`;
    } else if (type.tag === 'CreateContract') {
      const wasm = coerceKeyDataBuffer(type.values?.[0]);
      if (!wasm) return;
      key = `CreateContract:${wasm.toString('hex')}`;
    } else {
      return;
    }
    if (!seen.has(key)) {
      seen.add(key);
      types.push(type);
    }
  };
  const walk = (invocation: xdr.SorobanAuthorizedInvocation) => {
    const fn = invocation.function();
    const switchName = fn.switch().name;
    if (switchName === 'sorobanAuthorizedFunctionTypeContractFn') {
      const args = fn.contractFn();
      const contractAddress = Address.fromScAddress(args.contractAddress()).toString();
      add({ tag: 'CallContract', values: [contractAddress] });
    }
    for (const sub of invocation.subInvocations()) {
      walk(sub);
    }
  };
  walk(entry.rootInvocation());
  add({ tag: 'Default', values: undefined });
  return types;
}

type SignAuthEntryOptions = {
  credentialId?: string;
  expiration?: number;
  contextRuleIds?: number[];
  signer?: ContractSigner;
};

type PasskeyKitInternals = {
  rpId: string;
  webAuthn: SmartAccountKit['webAuthn'];
  networkPassphrase: string;
  webauthnVerifierAddress: string;
  calculateExpiration: () => Promise<number>;
  _credentialId?: string;
  /** Exact on-chain key_data bytes for the active passkey signer. */
  _passkeyKeyData?: Buffer;
  storage: SmartAccountKit['storage'];
};

/** Patch smart-account-kit 0.2.x signing for stellar-accounts 0.7 AuthPayload + auth digest. */
export function patchPasskeyAuthPayloadV07(kit: SmartAccountKit): void {
  const kitAny = kit as unknown as PasskeyKitInternals;

  kit.signAuthEntry = async (entry, options?: SignAuthEntryOptions) => {
    const entryXdrBytes = entry.toXDR();
    const normalizedEntry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdrBytes);
    const credentials = normalizedEntry.credentials().address();
    const expiration = options?.expiration ?? (await kitAny.calculateExpiration());
    credentials.signatureExpirationLedger(expiration);

    const authPayload = readAuthPayload(credentials.signature());

    const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(kitAny.networkPassphrase)),
        nonce: credentials.nonce(),
        signatureExpirationLedger: credentials.signatureExpirationLedger(),
        invocation: normalizedEntry.rootInvocation(),
      }),
    );
    const signaturePayload = hash(preimage.toXDR());
    const contextRuleIds = options?.contextRuleIds ?? authPayload.context_rule_ids;
    if (contextRuleIds.length === 0) {
      throw new Error(
        'contextRuleIds are required to sign smart account auth entries when the payload does not already include them',
      );
    }
    const authDigest = computeAuthDigest(signaturePayload, contextRuleIds);

    const credentialIdStr = options?.credentialId ?? kitAny._credentialId;
    if (!credentialIdStr) {
      throw new Error('A credential ID is required to sign smart account auth entries');
    }
    const authOptions = {
      challenge: base64url(authDigest),
      rpId: kitAny.rpId,
      userVerification: 'preferred' as const,
      timeout: WEBAUTHN_TIMEOUT_MS,
      allowCredentials: [{ id: credentialIdStr, type: 'public-key' as const }],
    };
    const authResponse = await kitAny.webAuthn.startAuthentication({ optionsJSON: authOptions });
    const assertion = readWebAuthnAssertionFields(authResponse.response);
    const rawSignature = base64url.toBuffer(assertion.signature);
    const compactedSignature = compactSignature(rawSignature);
    const credentialIdBuffer = base64url.toBuffer(authResponse.id);
    const signer = await resolveSigningExternalSigner(
      kit,
      kitAny,
      options,
      credentialIdBuffer,
      normalizedEntry,
    );
    const webAuthnSignature = buildWebAuthnSignatureBytes({
      authenticator_data: base64url.toBuffer(assertion.authenticatorData),
      client_data: base64url.toBuffer(assertion.clientDataJSON),
      signature: Buffer.from(compactedSignature),
    });

    if (
      authPayload.context_rule_ids.length > 0 &&
      authPayload.context_rule_ids.join(',') !== contextRuleIds.join(',')
    ) {
      throw new Error('Existing auth payload uses different context rule IDs');
    }

    authPayload.context_rule_ids = contextRuleIds;
    upsertAuthPayloadSigner(authPayload, signer, webAuthnSignature);
    credentials.signature(writeAuthPayload(authPayload));

    if (credentialIdStr) {
      try {
        await kitAny.storage.update(credentialIdStr, { lastUsedAt: Date.now() });
      } catch {
        // Credential may only exist in Lumengate session storage after reconnect.
      }
    }
    return normalizedEntry;
  };
}
