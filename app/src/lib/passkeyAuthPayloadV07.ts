import { Address, hash, xdr } from '@stellar/stellar-sdk';
import base64url from 'base64url';
import { WEBAUTHN_TIMEOUT_MS } from 'smart-account-kit';
import type { SmartAccountKit } from 'smart-account-kit';

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
    const fn = inv.function();
    const switchName = fn.switch().name;
    if (
      switchName === 'sorobanAuthorizedFunctionTypeContractFn' ||
      switchName.startsWith('sorobanAuthorizedFunctionTypeCreateContract')
    ) {
      count += 1;
    }
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

function buildAuthPayloadScVal(signerMapEntry: xdr.ScMapEntry, contextRuleIds: number[]): xdr.ScVal {
  const entries = [
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('context_rule_ids'),
      val: xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id))),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('signers'),
      val: xdr.ScVal.scvMap([signerMapEntry]),
    }),
  ];
  entries.sort((a, b) => a.key().toXDR('hex').localeCompare(b.key().toXDR('hex')));
  return xdr.ScVal.scvMap(entries);
}

/** Soroban address credentials expect AuthPayload as XDR bytes, not a raw ScVal map. */
function buildAuthPayloadSignature(signerMapEntry: xdr.ScMapEntry, contextRuleIds: number[]): xdr.ScVal {
  return xdr.ScVal.scvBytes(buildAuthPayloadScVal(signerMapEntry, contextRuleIds).toXDR());
}

function buildSignatureMapEntry(
  webauthnVerifierAddress: string,
  keyData: Buffer,
  sigData: { authenticator_data: Buffer; client_data: Buffer; signature: Buffer },
): xdr.ScMapEntry {
  const keyVal = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('External'),
    xdr.ScVal.scvAddress(Address.fromString(webauthnVerifierAddress).toScAddress()),
    xdr.ScVal.scvBytes(keyData),
  ]);
  const sigDataEntries = [
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
  ];
  sigDataEntries.sort((a, b) => a.key().toXDR('hex').localeCompare(b.key().toXDR('hex')));
  const sigDataScVal = xdr.ScVal.scvMap(sigDataEntries);
  return new xdr.ScMapEntry({
    key: keyVal,
    val: xdr.ScVal.scvBytes(sigDataScVal.toXDR()),
  });
}

async function findKeyDataByCredentialId(
  kit: SmartAccountKit,
  credentialId: Buffer,
  entry: xdr.SorobanAuthorizationEntry,
): Promise<Buffer> {
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
          const keyData = signer.values[1];
          if (keyData.length > SECP256R1_PUBLIC_KEY_SIZE) {
            const suffix = keyData.slice(SECP256R1_PUBLIC_KEY_SIZE);
            if (suffix.equals(credentialId)) {
              return keyData;
            }
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
    } else {
      key = `CreateContract:${Buffer.from(type.values?.[0] as Buffer).toString('hex')}`;
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

type SignAuthEntryOptions = { credentialId?: string; expiration?: number };

type PasskeyKitInternals = {
  rpId: string;
  webAuthn: SmartAccountKit['webAuthn'];
  networkPassphrase: string;
  webauthnVerifierAddress: string;
  calculateExpiration: () => Promise<number>;
  _credentialId?: string;
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

    const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(kitAny.networkPassphrase)),
        nonce: credentials.nonce(),
        signatureExpirationLedger: credentials.signatureExpirationLedger(),
        invocation: normalizedEntry.rootInvocation(),
      }),
    );
    const signaturePayload = hash(preimage.toXDR());
    const contextRuleIds = resolveDefaultContextRuleIds(normalizedEntry.rootInvocation());
    const authDigest = computeAuthDigest(signaturePayload, contextRuleIds);

    const credentialIdStr = options?.credentialId ?? kitAny._credentialId;
    const authOptions = {
      challenge: base64url(authDigest),
      rpId: kitAny.rpId,
      userVerification: 'preferred' as const,
      timeout: WEBAUTHN_TIMEOUT_MS,
      ...(credentialIdStr && {
        allowCredentials: [{ id: credentialIdStr, type: 'public-key' as const }],
      }),
    };
    const authResponse = await kitAny.webAuthn.startAuthentication({ optionsJSON: authOptions });
    const rawSignature = base64url.toBuffer(authResponse.response.signature);
    const compactedSignature = compactSignature(rawSignature);
    const credentialIdBuffer = base64url.toBuffer(authResponse.id);
    const keyData = await findKeyDataByCredentialId(kit, credentialIdBuffer, normalizedEntry);
    const scMapEntry = buildSignatureMapEntry(kitAny.webauthnVerifierAddress, keyData, {
      authenticator_data: base64url.toBuffer(authResponse.response.authenticatorData),
      client_data: base64url.toBuffer(authResponse.response.clientDataJSON),
      signature: Buffer.from(compactedSignature),
    });
    credentials.signature(buildAuthPayloadSignature(scMapEntry, contextRuleIds));

    if (credentialIdStr) {
      await kitAny.storage.update(credentialIdStr, { lastUsedAt: Date.now() });
    }
    return normalizedEntry;
  };
}
