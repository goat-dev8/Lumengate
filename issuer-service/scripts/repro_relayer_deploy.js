#!/usr/bin/env node
/** Reproduce deploy XDR relayer 503 (fee mismatch). */
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const {
  hash,
  Keypair,
  rpc,
  xdr,
  Address,
} = require('@stellar/stellar-sdk');
const { Client: SmartAccountClient } = require('../../app/vendor/smart-account-kit-bindings/dist/index.js');

const ROOT = join(__dirname, '../..');

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

const deployments = require('../../deployments.json');
const rpcUrl = process.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const networkPassphrase = process.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const DEPLOYER = Keypair.fromRawEd25519Seed(hash(Buffer.from('openzeppelin-smart-account-kit')));

function buildKeyData(publicKey, credentialId) {
  const cred = Buffer.isBuffer(credentialId) ? credentialId : Buffer.from(String(credentialId));
  return Buffer.concat([Buffer.from(publicKey), cred]);
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

async function main() {
  const credentialId = Buffer.from('repro-credential-' + Date.now());
  const fakePubKey = Buffer.alloc(65, 4);
  const keyData = buildKeyData(fakePubKey, credentialId);
  const policies = new Map();
  policies.set(deployments.compliance_policy, complianceInstallParamScVal());

  const tx = await SmartAccountClient.deploy(
    {
      signers: [{ tag: 'External', values: [deployments.webauthn_verifier, keyData] }],
      policies,
    },
    {
      networkPassphrase,
      rpcUrl,
      wasmHash: deployments.lumengate_smart_account_wasm_hash,
      publicKey: DEPLOYER.publicKey(),
      salt: hash(credentialId),
      timeoutInSeconds: 30,
    },
  );

  await tx.sign(DEPLOYER);
  const signed = tx.signed;
  console.log('fee on signed tx:', signed.fee);

  const server = new rpc.Server(rpcUrl);
  const sim = await server.simulateTransaction(signed);
  if (rpc.Api.isSimulationError(sim)) {
    console.log('sim error', sim);
  } else {
    console.log('minResourceFee:', sim.minResourceFee);
    console.log('fee matches resource?', String(signed.fee) === String(sim.minResourceFee));
  }

  const issuerUrl = process.env.ISSUER_SERVICE_URL || 'https://lumengate-issuer.onrender.com';
  const res = await fetch(`${issuerUrl}/relayer/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Name': 'smart-account-kit',
      'X-Client-Version': '0.3.0',
    },
    body: JSON.stringify({ xdr: signed.toXDR() }),
  });
  console.log('relayer HTTP', res.status);
  console.log(await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
