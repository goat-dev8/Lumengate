#!/usr/bin/env node
/**
 * Top up testnet faucet treasuries (XLM, USDC, EURC SAC + RWA treasury units).
 * Uses keys from .env — friendbots funders when classic XLM is low, deposits to native SAC,
 * path-pays USDC into SAC, mints deployer EURC, and admin_mints treasury units.
 *
 * Env overrides (reserve = per-asset claim count to keep on hand):
 *   FAUCET_XLM_RESERVE_CLAIMS=200
 *   FAUCET_USDC_RESERVE_CLAIMS=200
 *   FAUCET_EURC_RESERVE_CLAIMS=200
 *   FAUCET_TREASURY_RESERVE_CLAIMS=100
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import {
  Address,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

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

const STROOPS = 10_000_000n;
function fmtStroops(stroops) {
  const n = BigInt(stroops);
  const whole = n / STROOPS;
  const frac = n % STROOPS;
  return `${whole}.${String(frac).padStart(7, '0').replace(/0+$/, '') || '0'}`;
}

async function readTokenBalance(tokenId, holder, env) {
  const { getNetworkConfig } = require('../issuer-service/lib/sorobanAdmin.js');
  const { rpcUrl, passphrase } = getNetworkConfig(env);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const ro = new (await import('@stellar/stellar-sdk')).Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0',
  );
  const tx = new TransactionBuilder(ro, { fee: '100000', networkPassphrase: passphrase })
    .addOperation(new Contract(tokenId).call('balance', Address.fromString(holder).toScVal()))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return 0n;
  return BigInt(String(scValToNative(sim.result.retval)));
}

const env = loadEnv();
const { LIMITS } = require('../issuer-service/lib/faucet.js');
const {
  ensureNativeSacLiquidity,
  ensureUsdcSacLiquidity,
  ensureDeployerIssuedEurcLiquidity,
  readSacBalanceRaw,
  fundingCandidates,
  getUsdcSacId,
} = require('../issuer-service/lib/sacLiquidity.js');
const { adminMintTreasury } = require('../issuer-service/lib/sorobanAdmin.js');

const reserveClaims = {
  xlm: Number(env.FAUCET_XLM_RESERVE_CLAIMS || '200'),
  usdc: Number(env.FAUCET_USDC_RESERVE_CLAIMS || '200'),
  eurc: Number(env.FAUCET_EURC_RESERVE_CLAIMS || '200'),
  treasury: Number(env.FAUCET_TREASURY_RESERVE_CLAIMS || '100'),
};

async function printBalances(label, env) {
  const adminPk = env.CONTRACT_ADMIN_PUBLIC_KEY;
  const nativeSac = env.VITE_NATIVE_SAC_ID || env.NATIVE_SAC_ID;
  const usdcSac = getUsdcSacId(env);
  const eurcSac = env.VITE_EURC_SAC_ID || env.EURC_SAC_ID;
  const rwaToken = env.RWA_TOKEN_ID || env.VITE_RWA_TOKEN_ID;

  console.log(`\n=== ${label} ===`);
  console.log('Admin:', adminPk);
  for (const [name, sacId, limitKey] of [
    ['XLM SAC', nativeSac, 'xlm'],
    ['USDC SAC', usdcSac, 'usdc'],
    ['EURC SAC', eurcSac, 'eurc'],
  ]) {
    if (!sacId) continue;
    const perClaim = BigInt(LIMITS[limitKey].amount);
    let total = 0n;
    for (const c of fundingCandidates(env)) {
      const bal = await readSacBalanceRaw(sacId, c.publicKey, env);
      if (bal > 0n) {
        total += bal;
        console.log(`  ${c.label} ${name}: ${fmtStroops(bal)} (~${bal / perClaim} claims)`);
      }
    }
    console.log(`  ${name} total: ${fmtStroops(total)} (~${total / perClaim} claims @ ${LIMITS[limitKey].label})`);
  }
  if (rwaToken) {
    const bal = await readTokenBalance(rwaToken, adminPk, env);
    const perClaim = BigInt(LIMITS.treasury.amount);
    console.log(`  RWA treasury (admin): ${bal} units (~${bal / perClaim} claims @ ${LIMITS.treasury.label})`);
  }
}

async function main() {
  const adminPk = env.CONTRACT_ADMIN_PUBLIC_KEY;
  const nativeSac = env.VITE_NATIVE_SAC_ID || env.NATIVE_SAC_ID;
  const usdcSac = getUsdcSacId(env);
  const eurcSac = env.VITE_EURC_SAC_ID || env.EURC_SAC_ID;
  const rwaToken = env.RWA_TOKEN_ID || env.VITE_RWA_TOKEN_ID;

  console.log('Lumengate faucet treasury bootstrap');
  console.log('Reserve targets (claims):', reserveClaims);
  console.log('Per-claim limits:', LIMITS);

  await printBalances('Before', env);

  const xlmReserve = (BigInt(LIMITS.xlm.amount) * BigInt(reserveClaims.xlm)).toString();
  console.log(`\nBootstrapping XLM SAC (target ${fmtStroops(xlmReserve)} XLM)…`);
  const xlmOk = await ensureNativeSacLiquidity(nativeSac, xlmReserve, env);
  if (!xlmOk) console.warn('XLM SAC bootstrap incomplete — friendbot may be rate-limited; retry later.');

  const usdcReserve = (BigInt(LIMITS.usdc.amount) * BigInt(reserveClaims.usdc)).toString();
  console.log(`Bootstrapping USDC SAC (target ${fmtStroops(usdcReserve)} USDC)…`);
  const usdcOk = await ensureUsdcSacLiquidity(usdcSac, usdcReserve, env);
  if (!usdcOk) console.warn('USDC SAC bootstrap incomplete.');

  const eurcReserve = (BigInt(LIMITS.eurc.amount) * BigInt(reserveClaims.eurc)).toString();
  console.log(`Bootstrapping EURC SAC (target ${fmtStroops(eurcReserve)} EURC)…`);
  await ensureDeployerIssuedEurcLiquidity(eurcSac, eurcReserve, env);

  if (rwaToken && adminPk) {
    const treasuryReserve = BigInt(LIMITS.treasury.amount) * BigInt(reserveClaims.treasury);
    const current = await readTokenBalance(rwaToken, adminPk, env);
    if (current < treasuryReserve) {
      const mintAmount = treasuryReserve - current;
      console.log(`Minting ${mintAmount} RWA treasury units to admin…`);
      const hash = await adminMintTreasury(rwaToken, adminPk, String(mintAmount), env);
      console.log('Treasury mint tx:', hash);
    } else {
      console.log(`RWA treasury already sufficient (${current} units).`);
    }
  }

  await printBalances('After', env);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
