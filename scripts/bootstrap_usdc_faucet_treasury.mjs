#!/usr/bin/env node
/** Bootstrap USDC SAC treasury for the testnet faucet (admin-first, path-pay + deposit). */
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
const { ensureUsdcSacLiquidity, getUsdcSacId, readSacBalanceRaw, fundingCandidates } = require('../issuer-service/lib/sacLiquidity.js');
const { LIMITS } = require('../issuer-service/lib/faucet.js');

const sacId = getUsdcSacId(env);
const claimAmount = LIMITS.usdc.amount;
const targetClaims = Number(process.env.FAUCET_USDC_RESERVE_CLAIMS || '50');

async function main() {
  console.log('Bootstrapping USDC faucet treasury…');
  console.log('SAC:', sacId);
  console.log('Per claim:', LIMITS.usdc.label, `(${claimAmount} stroops)`);
  console.log('Target reserve claims:', targetClaims);

  const reserve = (BigInt(claimAmount) * BigInt(targetClaims)).toString();
  const ok = await ensureUsdcSacLiquidity(sacId, reserve, env);
  if (!ok) {
    throw new Error('USDC SAC bootstrap failed — check CONTRACT_ADMIN_SECRET_KEY and XLM for path payments');
  }

  console.log('--- Treasury after bootstrap ---');
  for (const c of fundingCandidates(env)) {
    const bal = await readSacBalanceRaw(sacId, c.publicKey, env);
    if (bal > 0n) {
      console.log(`${c.label}: ${(Number(bal) / 1e7).toFixed(4)} USDC SAC`);
    }
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
