#!/usr/bin/env node
/**
 * Sync VITE_* env vars from repo .env to Vercel project lumengatex.
 * Usage: VERCEL_TOKEN=... node scripts/sync_vercel_env.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ID = 'prj_4zHHYVgvsxEbnSxvvFzOLS1bOV1R';
const TOKEN = process.env.VERCEL_TOKEN || process.env.VITE_VERCEL_TOKEN;
if (!TOKEN) {
  console.error('Set VERCEL_TOKEN');
  process.exit(1);
}

function parseEnv(path) {
  const out = {};
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

const env = parseEnv(join(ROOT, '.env'));
const wanted = Object.entries(env).filter(([key]) => key.startsWith('VITE_'));
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const listRes = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env`, { headers });
if (!listRes.ok) {
  console.error('Failed to list env', listRes.status, await listRes.text());
  process.exit(1);
}
const existing = (await listRes.json()).envs ?? [];
const byKey = new Map(existing.map((item) => [item.key, item]));

for (const [key, value] of wanted) {
  const current = byKey.get(key);
  if (current?.value === value) {
    console.log('OK', key);
    continue;
  }
  if (current) {
    const del = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${current.id}`, {
      method: 'DELETE',
      headers,
    });
    if (!del.ok) {
      console.error('Delete failed', key, del.status, await del.text());
      process.exit(1);
    }
  }
  const create = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key,
      value,
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    }),
  });
  if (!create.ok) {
    console.error('Create failed', key, create.status, await create.text());
    process.exit(1);
  }
  console.log('UPDATED', key, '=', value.slice(0, 60));
}

console.log(`Synced ${wanted.length} VITE_* variables.`);
