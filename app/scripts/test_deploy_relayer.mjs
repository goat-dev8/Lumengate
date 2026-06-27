#!/usr/bin/env node
/** Build smart-account deploy XDR and POST to issuer /relayer/submit. */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hash, Keypair, rpc, xdr, Address, TransactionBuilder } from '@stellar/stellar-sdk';
import { Client as SmartAccountClient } from '../vendor/smart-account-kit-bindings/dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function loadEnv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const deployments = JSON.parse(readFileSync(join(ROOT, 'deployments.json'), 'utf8'));
const rpcUrl = process.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const networkPassphrase = process.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const DEPLOYER = Keypair.fromRawEd25519Seed(hash(Buffer.from('openzeppelin-smart-account-kit')));

function buildKeyData(publicKey, credentialId) {
  return Buffer.concat([Buffer.from(publicKey), Buffer.from(credentialId)]);
}

function complianceInstallParamScVal() {
  const entries = [
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('adapter'), val: Address.fromString(deployments.rwa_adapter).toScVal() }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('policy_id'), val: xdr.ScVal.scvU32(Number(process.env.VITE_POLICY_ID || 1)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('session_store'), val: Address.fromString(deployments.session_store).toScVal() }),
  ];
  entries.sort((a, b) => a.key().toXDR('hex').localeCompare(b.key().toXDR('hex')));
  return xdr.ScVal.scvMap(entries);
}

const issuerUrl = process.env.ISSUER_SERVICE_URL || 'http://localhost:3001';

const credentialId = Buffer.from(`repro-${Date.now()}`);
const fakePubKey = Buffer.alloc(65, 4);
const keyData = buildKeyData(fakePubKey, credentialId);
const policies = new Map([[deployments.compliance_policy, complianceInstallParamScVal()]]);

const tx = await SmartAccountClient.deploy(
  { signers: [{ tag: 'External', values: [deployments.webauthn_verifier, keyData] }], policies },
  {
    networkPassphrase,
    rpcUrl,
    wasmHash: deployments.lumengate_smart_account_wasm_hash,
    publicKey: DEPLOYER.publicKey(),
    salt: hash(credentialId),
    timeoutInSeconds: 30,
  },
);

await tx.sign({
  signTransaction: async (txXdr) => {
    const parsed = TransactionBuilder.fromXDR(txXdr, networkPassphrase);
    parsed.sign(DEPLOYER);
    return { signedTxXdr: parsed.toXDR(), signerAddress: DEPLOYER.publicKey() };
  },
});
const signed = tx.signed;
console.log('signed fee:', signed.fee);

const sim = await new rpc.Server(rpcUrl).simulateTransaction(signed);
if (!rpc.Api.isSimulationError(sim)) {
  console.log('minResourceFee:', sim.minResourceFee, 'match?', String(signed.fee) === String(sim.minResourceFee));
}

const res = await fetch(`${issuerUrl.replace(/\/+$/, '')}/relayer/submit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Name': 'smart-account-kit',
    'X-Client-Version': '0.3.0',
  },
  body: JSON.stringify({ xdr: signed.toXDR() }),
});
console.log('HTTP', res.status, await res.text());
