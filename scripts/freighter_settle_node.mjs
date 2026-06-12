#!/usr/bin/env node
/**
 * Freighter USDC settlement via ComplianceSacAdmin.
 * Requires FREIGHTER_SECRET in .env (export from Freighter → Settings → Show secret key).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import {
  Contract,
  Keypair,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/\r/g, '');
  }
  return env;
}

function scBytesFromHex(hex) {
  const h = hex.replace(/^0x/, '');
  return xdr.ScVal.scvBytes(Buffer.from(h, 'hex'));
}

function walletFieldFromAddress(address) {
  const slice = createHash('sha256').update(address).digest('hex').slice(0, 14);
  return BigInt(`0x${slice}`).toString();
}

async function waitTx(server, hash) {
  for (let i = 0; i < 40; i++) {
    const tx = await server.getTransaction(hash);
    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) return tx;
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error(`tx failed: ${hash}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`timeout waiting for ${hash}`);
}

const env = loadEnv();
const freighter = env.FREIGHTER_PUBLIC_KEY;
const secret = process.env.FREIGHTER_SECRET || env.FREIGHTER_SECRET;
if (!secret) {
  console.error('FREIGHTER_SECRET required — add to .env then re-run');
  process.exit(2);
}

const kp = Keypair.fromSecret(secret);
if (kp.publicKey() !== freighter) {
  console.error('FREIGHTER_SECRET public key mismatch');
  process.exit(2);
}

const rpcUrl = env.VITE_STELLAR_RPC_URL;
const passphrase = env.VITE_NETWORK_PASSPHRASE;
const sacAdmin = env.COMPLIANCE_SAC_ADMIN_ID;
const treasury = env.VITE_MARKETPLACE_SETTLEMENT_ADDRESS;
const amount = BigInt(process.env.SETTLE_AMOUNT || '10000000');
const issuer = process.env.ISSUER_SERVICE_URL || 'http://127.0.0.1:3001';
const wf = walletFieldFromAddress(freighter);

console.log('=== Freighter settle ===');
console.log('wallet', freighter);
console.log('walletField', wf);
console.log('amount_stroops', amount.toString());

const credRes = await fetch(`${issuer}/credential`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletField: wf, policyKey: 'general-eligibility' }),
});
if (!credRes.ok) throw new Error(await credRes.text());
writeFileSync('/tmp/freighter_cred.json', await credRes.text());
execSync(`node ${join(ROOT, 'scripts/write_prover_from_credential.mjs')} /tmp/freighter_cred.json`, { stdio: 'inherit' });
execSync(`bash ${join(ROOT, 'scripts/build_circuit.sh')}`, { stdio: 'inherit' });

const proofHex = readFileSync(join(ROOT, 'circuits/lumengate/target/proof')).toString('hex');
const piHex = readFileSync(join(ROOT, 'circuits/lumengate/target/public_inputs')).toString('hex');

const server = new rpc.Server(rpcUrl);
const acct = await server.getAccount(freighter);
const contract = new Contract(sacAdmin);
const draft = new TransactionBuilder(acct, {
  fee: String(Number(BASE_FEE) * 100),
  networkPassphrase: passphrase,
})
  .addOperation(
    contract.call(
      'transfer_compliant',
      nativeToScVal(freighter, { type: 'address' }),
      nativeToScVal(treasury, { type: 'address' }),
      nativeToScVal(amount, { type: 'i128' }),
      scBytesFromHex(proofHex),
      scBytesFromHex(piHex),
    ),
  )
  .setTimeout(120)
  .build();

const sim = await server.simulateTransaction(draft);
if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error || 'simulation failed');

const assembled = rpc.assembleTransaction(draft, sim);
const tx = assembled.build();
const { signAuthEntry } = basicNodeSigner(kp, passphrase);

if (sim.result?.auth?.length) {
  for (let i = 0; i < sim.result.auth.length; i++) {
    const entry = sim.result.auth[i];
    const entryXdr = entry.toXDR('base64');
    const { signedAuthEntry } = await signAuthEntry(entryXdr, { address: freighter });
    const signed = xdr.SorobanAuthorizationEntry.fromXDR(signedAuthEntry, 'base64');
    assembled.setSorobanAuthorization(i, signed);
  }
}

const finalTx = assembled.build();
finalTx.sign(kp);

const send = await server.sendTransaction(finalTx);
if (send.status === 'ERROR') throw new Error(JSON.stringify(send.errorResult || send));
const hash = send.hash;
console.log('settle_tx', hash);
console.log('explorer', `${env.VITE_EXPLORER_BASE_URL}/tx/${hash}`);

const result = await waitTx(server, hash);
console.log('ledger', result.ledger);
console.log('DONE');
