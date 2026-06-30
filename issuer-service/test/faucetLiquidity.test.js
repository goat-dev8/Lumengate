const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

function loadRootEnv() {
  const envPath = join(__dirname, '..', '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadRootEnv();

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fundingCandidates,
  getUsdcSacId,
  pickSacFunder,
} = require('../lib/sacLiquidity');
const { LIMITS } = require('../lib/faucet');

test('getUsdcSacId falls back to canonical testnet SAC', () => {
  const sac = getUsdcSacId({});
  assert.equal(sac, 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA');
});

test('pickSacFunder ignores wallets without USDC trustline', async () => {
  const sac = getUsdcSacId(process.env);
  const funder = await pickSacFunder(sac, LIMITS.usdc.amount, process.env);
  assert.ok(funder, 'expected a USDC faucet funder on testnet');
  assert.ok(funder.publicKey.startsWith('G'));
});

test('fundingCandidates prefers configured admin first in code ordering', () => {
  const rows = fundingCandidates(process.env);
  if (process.env.CONTRACT_ADMIN_PUBLIC_KEY) {
    assert.equal(rows[0]?.publicKey, process.env.CONTRACT_ADMIN_PUBLIC_KEY);
  }
});
