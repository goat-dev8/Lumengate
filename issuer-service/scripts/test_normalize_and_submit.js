#!/usr/bin/env node
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { hash, Keypair, rpc, TransactionBuilder } = require('@stellar/stellar-sdk');
const { Client: SmartAccountClient } = require('../../app/vendor/smart-account-kit-bindings/dist/index.js');
const { normalizeSignedSorobanXdr } = require('../lib/relayerXdrNormalize');

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
const rpcUrl = process.env.STELLAR_RPC_URL || process.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || process.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const DEPLOYER = Keypair.fromRawEd25519Seed(hash(Buffer.from('openzeppelin-smart-account-kit')));

async function main() {
  const credentialId = Buffer.from(`norm-${Date.now()}`);
  const fakePubKey = Buffer.alloc(65, 4);
  const keyData = Buffer.concat([fakePubKey, credentialId]);

  const tx = await SmartAccountClient.deploy(
    {
      signers: [{ tag: 'External', values: [deployments.webauthn_verifier, keyData] }],
      policies: new Map(),
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

  await tx.sign({
    signTransaction: async (txXdr) => {
      const parsed = TransactionBuilder.fromXDR(txXdr, networkPassphrase);
      parsed.sign(DEPLOYER);
      return { signedTxXdr: parsed.toXDR(), signerAddress: DEPLOYER.publicKey() };
    },
  });

  const signed = tx.signed;
  console.log('original fee:', signed.fee);
  const sim = await new rpc.Server(rpcUrl).simulateTransaction(signed);
  if (!rpc.Api.isSimulationError(sim)) {
    console.log('minResourceFee:', sim.minResourceFee);
  }

  const normalized = await normalizeSignedSorobanXdr(signed.toXDR());
  const normTx = new (require('@stellar/stellar-sdk').Transaction)(normalized, networkPassphrase);
  const resim = await new rpc.Server(rpcUrl).simulateTransaction(normTx);
  console.log('normalized fee:', normTx.fee);
  if (!rpc.Api.isSimulationError(resim)) {
    console.log('resim minResourceFee:', resim.minResourceFee, 'aligned?', String(normTx.fee) === String(resim.minResourceFee));
  }

  const issuerUrl = process.env.ISSUER_SERVICE_URL || 'https://lumengate-issuer.onrender.com';
  const res = await fetch(`${issuerUrl.replace(/\/+$/, '')}/relayer/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Name': 'smart-account-kit',
      'X-Client-Version': '0.3.0',
    },
    body: JSON.stringify({ xdr: signed.toXDR() }),
  });
  console.log('relayer', res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
