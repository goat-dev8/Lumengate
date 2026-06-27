#!/usr/bin/env node
/**
 * Sync relayer env vars from repo .env to Render lumengate-issuer service.
 * Usage: node scripts/sync_render_env.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-d8tjopreo5us73bidav0';

function parseEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const token = process.env.RENDER_API_KEY;
if (!token) {
  console.error('Set RENDER_API_KEY');
  process.exit(1);
}

const env = parseEnv(join(ROOT, '.env'));
const keys = ['CHANNELS_API_KEY', 'CHANNELS_BASE_URL', 'RELAYER_ENABLED'];
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

for (const key of keys) {
  const value = env[key];
  if (!value) {
    console.warn('SKIP (missing in .env):', key);
    continue;
  }
  const listRes = await fetch(`https://api.render.com/v1/services/${SERVICE_ID}/env-vars`, { headers });
  if (!listRes.ok) {
    console.error('List env failed', listRes.status, await listRes.text());
    process.exit(1);
  }
  const rows = await listRes.json();
  const existing = Array.isArray(rows)
    ? rows.find((row) => row.envVar?.key === key)
    : undefined;
  const putRes = await fetch(
    `https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ value }),
    },
  );
  if (!putRes.ok) {
    console.error('Upsert failed', key, putRes.status, await putRes.text());
    process.exit(1);
  }
  console.log(existing ? 'UPDATED' : 'CREATED', key);
}

console.log('Render env sync complete.');
