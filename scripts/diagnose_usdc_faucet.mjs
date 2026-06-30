#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function loadEnv() {
  const env = { ...process.env };
  const text = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const { fundingCandidates, readSacBalanceRaw } = require('../issuer-service/lib/sacLiquidity.js');
const { Horizon, Asset } = require('@stellar/stellar-sdk');

const sac = env.VITE_USDC_SAC_ID || env.USDC_SAC_ID;
const issuer = env.VITE_USDC_ISSUER || env.USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const horizon = new Horizon.Server(env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org');
const usdc = new Asset('USDC', issuer);

async function classicUsdc(pk) {
  try {
    const acct = await horizon.loadAccount(pk);
    const row = acct.balances.find((b) => b.asset_code === 'USDC' && b.asset_issuer === issuer);
    return row?.balance ?? '0';
  } catch {
    return 'unfunded';
  }
}

console.log('USDC SAC:', sac);
console.log('USDC Issuer:', issuer);
console.log('--- Wallets ---');
for (const c of fundingCandidates(env)) {
  const sacBal = await readSacBalanceRaw(sac, c.publicKey, env);
  const classic = await classicUsdc(c.publicKey);
  console.log(JSON.stringify({
    label: c.label,
    publicKey: c.publicKey,
    sacUsdc: (Number(sacBal) / 1e7).toFixed(4),
    classicUsdc: classic,
    hasSecret: Boolean(c.secret),
  }));
}
