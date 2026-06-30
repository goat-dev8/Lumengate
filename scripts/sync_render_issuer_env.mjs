#!/usr/bin/env node
/** Sync required issuer env vars from local .env to Render (lumengate-issuer). */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-d8tjopreo5us73bidav0';

function loadEnv() {
  const env = {};
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

const SYNC_KEYS = [
  'VITE_USDC_ISSUER',
  'USDC_ISSUER',
  'VITE_USDC_SAC_ID',
  'USDC_SAC_ID',
  'FRIENDBOT_URL',
  'ELIGIBLE_WALLET_SECRET',
  'ELIGIBLE_WALLET_PUBLIC_KEY',
  'DEPLOYER_SECRET_KEY',
  'DEPLOYER_PUBLIC_KEY',
  'STELLAR_HORIZON_URL',
  'STELLAR_NETWORK_PASSPHRASE',
  'STELLAR_RPC_URL',
];

const local = loadEnv();
const apiKey = local.RENDER_API_KEY || process.env.RENDER_API_KEY;
if (!apiKey) throw new Error('RENDER_API_KEY missing in .env');

const headers = {
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};

async function listEnv() {
  const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/env-vars?limit=100`, { headers });
  if (!res.ok) throw new Error(`List env failed: ${res.status}`);
  const rows = await res.json();
  return new Map(rows.map((row) => [row.envVar.key, row.envVar.value]));
}

async function putEnv(key, value) {
  const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PUT ${key} failed: ${res.status} ${detail.slice(0, 200)}`);
  }
}

async function triggerDeploy() {
  const res = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/deploys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clearCache: 'do_not_clear' }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Deploy trigger failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  const body = await res.json();
  return body.id || body.deploy?.id || 'queued';
}

const defaults = {
  VITE_USDC_ISSUER: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  USDC_ISSUER: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  FRIENDBOT_URL: 'https://friendbot.stellar.org',
};

const remote = await listEnv();
const updates = [];
for (const key of SYNC_KEYS) {
  const value = local[key] || defaults[key];
  if (!value) continue;
  if (remote.get(key) === value) continue;
  updates.push({ key, value });
}

if (updates.length === 0) {
  console.log('Render env already up to date for faucet keys.');
} else {
  for (const { key, value } of updates) {
    await putEnv(key, value);
    console.log('Updated', key);
  }
}

const deployId = await triggerDeploy();
console.log('Triggered Render deploy:', deployId);
