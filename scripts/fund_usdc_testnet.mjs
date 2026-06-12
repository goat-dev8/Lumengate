#!/usr/bin/env node
/** Establish USDC trustline and acquire testnet USDC via path payment (DEX). */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function env(name) {
  const line = readFileSync(join(ROOT, '.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`Missing ${name}`);
  return line.slice(name.length + 1).trim().replace(/\r$/, '');
}

const horizonUrl = env('STELLAR_HORIZON_URL');
const rpcUrl = env('STELLAR_RPC_URL');
const usdcIssuer = env('VITE_USDC_ISSUER');
const usdcSac = env('VITE_USDC_SAC_ID');
const eligibleSecret = env('ELIGIBLE_WALLET_SECRET');
const passphrase = env('STELLAR_NETWORK_PASSPHRASE');

const server = new Horizon.Server(horizonUrl);
const usdc = new Asset('USDC', usdcIssuer);
const kp = Keypair.fromSecret(eligibleSecret);
const accountId = kp.publicKey();

async function loadAccount() {
  try {
    return await server.loadAccount(accountId);
  } catch {
    await fetch(`${env('FRIENDBOT_URL')}?addr=${accountId}`);
    await new Promise((r) => setTimeout(r, 3000));
    return server.loadAccount(accountId);
  }
}

async function submit(ops) {
  const acct = await loadAccount();
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperations(ops)
    .setTimeout(120)
    .build();
  tx.sign(kp);
  return server.submitTransaction(tx);
}

async function readSacBalance() {
  const s = new rpc.Server(rpcUrl);
  const ro = new (await import('@stellar/stellar-sdk')).Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0',
  );
  const contract = new Contract(usdcSac);
  const tx = new TransactionBuilder(ro, { fee: '100000', networkPassphrase: passphrase })
    .addOperation(contract.call('balance', nativeToScVal(accountId, { type: 'address' })))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return String(scValToNative(sim.result.retval));
}

async function main() {
  console.log('Account:', accountId);
  const acct = await loadAccount();
  const hasTrust = acct.balances.some(
    (b) => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer,
  );
  if (!hasTrust) {
    console.log('Adding USDC trustline…');
    const r = await submit([Operation.changeTrust({ asset: usdc, limit: '1000000' })]);
    console.log('Trustline tx:', r.hash);
  }

  const refreshed = await loadAccount();
  const classic = refreshed.balances.find(
    (b) => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer,
  );
  if (!classic || Number(classic.balance) < 1) {
    console.log('Swapping 5 XLM → USDC…');
    const r = await submit([
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '5',
        destination: accountId,
        destAsset: usdc,
        destMin: '1',
      }),
    ]);
    console.log('Path payment tx:', r.hash);
  }

  const finalClassic = (await loadAccount()).balances.find(
    (b) => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer,
  );
  console.log('Classic USDC:', finalClassic?.balance ?? '0');
  const sacRaw = await readSacBalance();
  console.log('SAC balance (stroops):', sacRaw);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
