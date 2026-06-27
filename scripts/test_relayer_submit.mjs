#!/usr/bin/env node
/**
 * Phase 1.5 — verify issuer /relayer/submit independently (no passkey deploy).
 * Submits a minimal signed testnet payment XDR via Channels proxy.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as StellarSdk from '@stellar/stellar-sdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    if (!process.env[key]) {
      let val = line.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnv();

const issuerUrl =
  process.env.ISSUER_SERVICE_URL ||
  process.env.VITE_ISSUER_SERVICE_URL ||
  'http://localhost:3001';
const relayerUrl = `${issuerUrl.replace(/\/+$/, '')}/relayer/submit`;

async function buildSignedPaymentXdr() {
  const rpc = new StellarSdk.rpc.Server(
    process.env.STELLAR_RPC_URL || process.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  );
  const passphrase =
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    process.env.VITE_NETWORK_PASSPHRASE ||
    StellarSdk.Networks.TESTNET;
  const secret = process.env.DEPLOYER_SECRET_KEY;
  if (!secret) {
    throw new Error('DEPLOYER_SECRET_KEY required in .env for relayer smoke test');
  }
  const source = StellarSdk.Keypair.fromSecret(secret);
  const account = await rpc.getAccount(source.publicKey());
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: source.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '0.0000001',
      }),
    )
    .setTimeout(30)
    .build();
  tx.sign(source);
  return tx.toXDR();
}

async function main() {
  console.log('Relayer proxy URL:', relayerUrl);
  const health = await fetch(`${issuerUrl.replace(/\/+$/, '')}/health`);
  if (!health.ok) {
    throw new Error(`Issuer health failed: ${health.status}`);
  }
  const healthJson = await health.json();
  console.log('Issuer health:', JSON.stringify(healthJson.relayer ?? healthJson, null, 2));

  const xdr = await buildSignedPaymentXdr();
  const res = await fetch(relayerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xdr }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 400)}`);
  }
  if (!res.ok || !json.success) {
    throw new Error(`Relayer submit failed (${res.status}): ${JSON.stringify(json)}`);
  }
  console.log('Relayer submit OK:', json);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
