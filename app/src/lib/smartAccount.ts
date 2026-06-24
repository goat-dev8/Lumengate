import {
  Contract,
  Address,
  Operation,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  Account,
  StrKey,
} from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';
import { passkeyRegisteredFor, signWithPasskey, type StoredPasskey } from './passkeys';

function server(rpcUrl: string) {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
}

function readOnlyAccount(): Account {
  return new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  return Uint8Array.from(clean.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function scBytes(bytes: Uint8Array | Buffer): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

function scMapEntry(key: xdr.ScVal, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({ key, val });
}

function derSignatureToRaw64(signatureHex: string): Uint8Array {
  const bytes = hexToBytes(signatureHex);
  if (bytes.length === 64) return bytes;
  if (bytes[0] !== 0x30) throw new Error('Passkey returned an unsupported signature format');
  let offset = 2;
  if (bytes[1] & 0x80) offset = 2 + (bytes[1] & 0x7f);
  if (bytes[offset] !== 0x02) throw new Error('Invalid passkey signature R component');
  const rLen = bytes[offset + 1];
  const r = bytes.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  if (bytes[offset] !== 0x02) throw new Error('Invalid passkey signature S component');
  const sLen = bytes[offset + 1];
  const s = bytes.slice(offset + 2, offset + 2 + sLen);

  const normalize = (part: Uint8Array) => {
    const trimmed = part.length > 32 && part[0] === 0 ? part.slice(part.length - 32) : part;
    if (trimmed.length > 32) throw new Error('Invalid passkey signature length');
    const out = new Uint8Array(32);
    out.set(trimmed, 32 - trimmed.length);
    return out;
  };

  return concatBytes(normalize(r), normalize(s));
}

function webAuthnSigDataXdr(assertion: {
  authenticatorData: string;
  clientDataJson: string;
  signature: string;
}): Buffer {
  const sigData = xdr.ScVal.scvMap([
    scMapEntry(
      xdr.ScVal.scvSymbol('authenticator_data'),
      scBytes(hexToBytes(assertion.authenticatorData)),
    ),
    scMapEntry(
      xdr.ScVal.scvSymbol('client_data'),
      scBytes(new TextEncoder().encode(assertion.clientDataJson)),
    ),
    scMapEntry(
      xdr.ScVal.scvSymbol('signature'),
      scBytes(derSignatureToRaw64(assertion.signature)),
    ),
  ]);
  return Buffer.from(sigData.toXDR());
}

function signerExternal(config: DeploymentConfig, passkey: StoredPasskey): xdr.ScVal {
  const verifierId = config.webauthnVerifierId;
  if (!verifierId || !StrKey.isValidContract(verifierId)) {
    throw new Error('WebAuthn verifier contract not configured');
  }
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('External'),
    Address.fromString(verifierId).toScVal(),
    scBytes(hexToBytes(passkey.keyDataHex)),
  ]);
}

function authPayloadScVal(
  config: DeploymentConfig,
  passkey: StoredPasskey,
  contextRuleIds: number[],
  sigDataXdr: Buffer,
): xdr.ScVal {
  const contextIds = xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id)));
  const signers = xdr.ScVal.scvMap([
    scMapEntry(signerExternal(config, passkey), scBytes(sigDataXdr)),
  ]);
  return xdr.ScVal.scvMap([
    scMapEntry(xdr.ScVal.scvSymbol('context_rule_ids'), contextIds),
    scMapEntry(xdr.ScVal.scvSymbol('signers'), signers),
  ]);
}

function countInvocations(invocation: xdr.SorobanAuthorizedInvocation): number {
  return (
    1 +
    invocation
      .subInvocations()
      .reduce((sum, sub) => sum + countInvocations(sub), 0)
  );
}

function smartAddressMatches(credentials: xdr.SorobanAddressCredentials, smartAccountId: string): boolean {
  return Address.fromScAddress(credentials.address()).toString() === smartAccountId;
}

function isSmartAccountReady(config: DeploymentConfig, passkey: StoredPasskey | null): passkey is StoredPasskey {
  return passkeyRegisteredFor(passkey, config.lumengateSmartAccountId, config.webauthnVerifierId);
}

export function canUseSmartAccountSettlement(
  config: DeploymentConfig,
  passkey: StoredPasskey | null,
): passkey is StoredPasskey {
  return isSmartAccountReady(config, passkey);
}

export function smartAccountSettlementAddress(config: DeploymentConfig, passkey: StoredPasskey | null): string | null {
  if (!isSmartAccountReady(config, passkey)) return null;
  return config.lumengateSmartAccountId ?? null;
}

/** Register passkey signer on LumengateSmartAccount (admin-delegated bootstrap). */
export async function registerPasskeyOnSmartAccount(params: {
  config: DeploymentConfig;
  adminSecret: string;
  passkey: StoredPasskey;
}): Promise<string> {
  const { config, adminSecret, passkey } = params;
  const smartId = config.lumengateSmartAccountId;
  const verifierId = import.meta.env.VITE_WEBAUTHN_VERIFIER_ID;
  if (!smartId || !StrKey.isValidContract(smartId)) {
    throw new Error('Lumengate smart account not configured');
  }
  if (!verifierId || !StrKey.isValidContract(String(verifierId))) {
    throw new Error('WebAuthn verifier contract not configured (VITE_WEBAUTHN_VERIFIER_ID)');
  }

  const adminKp = await import('@stellar/stellar-sdk').then((m) => m.Keypair.fromSecret(adminSecret));
  const s = server(config.rpcUrl);
  const adminAccount = await s.getAccount(adminKp.publicKey());
  const contract = new Contract(smartId);
  const tx = new TransactionBuilder(adminAccount, {
    fee: '500000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'add_passkey',
        nativeToScVal(adminKp.publicKey(), { type: 'address' }),
        nativeToScVal(String(verifierId), { type: 'address' }),
        xdr.ScVal.scvBytes(Buffer.from(passkey.keyDataHex, 'hex')),
      ),
    )
    .setTimeout(120)
    .build();

  tx.sign(adminKp);
  const sent = await s.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(`Passkey registration failed: ${sent.status}`);
  }
  return sent.hash;
}

export async function bindSessionProof(params: {
  config: DeploymentConfig;
  adminSecret: string;
  proofHex: string;
  publicInputsHex: string;
}): Promise<string> {
  const { config, adminSecret, proofHex, publicInputsHex } = params;
  const smartId = config.lumengateSmartAccountId;
  const policyId = config.compliancePolicyId;
  if (!smartId || !policyId) throw new Error('Smart account or compliance policy not configured');

  const adminKp = await import('@stellar/stellar-sdk').then((m) => m.Keypair.fromSecret(adminSecret));
  const s = server(config.rpcUrl);
  const adminAccount = await s.getAccount(adminKp.publicKey());
  const contract = new Contract(smartId);
  const tx = new TransactionBuilder(adminAccount, {
    fee: '500000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'bind_session_proof',
        nativeToScVal(smartId, { type: 'address' }),
        nativeToScVal(policyId, { type: 'address' }),
        xdr.ScVal.scvBytes(Buffer.from(proofHex, 'hex')),
        xdr.ScVal.scvBytes(Buffer.from(publicInputsHex, 'hex')),
      ),
    )
    .setTimeout(120)
    .build();

  tx.sign(adminKp);
  const sent = await s.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(`bind_session_proof failed: ${sent.status}`);
  }
  return sent.hash;
}

export async function authorizeSmartAccountTransaction(params: {
  config: DeploymentConfig;
  transactionXdr: string;
  passkey: StoredPasskey;
  contextRuleId?: number;
}): Promise<string> {
  const { config, transactionXdr, passkey, contextRuleId = 0 } = params;
  const smartId = config.lumengateSmartAccountId;
  if (!isSmartAccountReady(config, passkey) || !smartId) {
    throw new Error('Smart account passkey is not registered for this deployment');
  }

  const tx = TransactionBuilder.fromXDR(transactionXdr, config.networkPassphrase);
  if ('innerTransaction' in tx) {
    throw new Error('Smart account authorization does not support fee-bump envelopes');
  }
  if (tx.operations.length !== 1 || tx.operations[0].type !== 'invokeHostFunction') {
    throw new Error('Smart account authorization requires a single Soroban invocation');
  }
  const op = tx.operations[0];
  const auth = op.auth ?? [];
  const authIndex = auth.findIndex((entry) => {
    const credentials = entry.credentials();
    if (credentials.switch().name !== 'sorobanCredentialsAddress') return false;
    return smartAddressMatches(credentials.address(), smartId);
  });
  if (authIndex === -1) {
    throw new Error('Transaction does not contain smart-account authorization');
  }

  const entry = auth[authIndex];
  const addressCredentials = entry.credentials().address();
  const rootInvocation = entry.rootInvocation();
  const contextRuleIds = Array.from(
    { length: countInvocations(rootInvocation) },
    () => contextRuleId,
  );
  const contextIdsXdr = xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id))).toXDR();
  const networkId = await sha256(new TextEncoder().encode(config.networkPassphrase));
  const preimage = new xdr.HashIdPreimageSorobanAuthorization({
    networkId: Buffer.from(networkId),
    nonce: addressCredentials.nonce(),
    signatureExpirationLedger: addressCredentials.signatureExpirationLedger(),
    invocation: rootInvocation,
  });
  const signaturePayload = await sha256(
    new Uint8Array(xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(preimage).toXDR()),
  );
  const authDigest = await sha256(concatBytes(signaturePayload, new Uint8Array(contextIdsXdr)));
  const assertion = await signWithPasskey(bytesToHex(authDigest));
  const signature = authPayloadScVal(config, passkey, contextRuleIds, webAuthnSigDataXdr(assertion));

  const authorizedCredentials = xdr.SorobanCredentials.sorobanCredentialsAddress(
    new xdr.SorobanAddressCredentials({
      address: addressCredentials.address(),
      nonce: addressCredentials.nonce(),
      signatureExpirationLedger: addressCredentials.signatureExpirationLedger(),
      signature,
    }),
  );
  const authorizedEntry = new xdr.SorobanAuthorizationEntry({
    credentials: authorizedCredentials,
    rootInvocation,
  });
  const nextAuth = [...auth];
  nextAuth[authIndex] = authorizedEntry;

  const builder = TransactionBuilder.cloneFrom(tx, {
    fee: tx.fee,
    networkPassphrase: config.networkPassphrase,
  });
  builder.clearOperations();
  builder.addOperation(
    Operation.invokeHostFunction({
      source: op.source,
      func: op.func,
      auth: nextAuth,
    }),
  );
  return builder.build().toXDR();
}

export async function readSmartAccountContextRules(config: DeploymentConfig): Promise<number> {
  const smartId = config.lumengateSmartAccountId;
  if (!smartId) return 0;
  const s = server(config.rpcUrl);
  const contract = new Contract(smartId);
  const tx = new TransactionBuilder(readOnlyAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('get_context_rules_count'))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const val = sim.result?.retval;
  if (!val) return 0;
  return Number(val.u32());
}
