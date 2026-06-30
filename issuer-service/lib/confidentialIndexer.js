const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { rpc, xdr, Address, scValToNative } = require('@stellar/stellar-sdk');

const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(__dirname, '..', 'data');

const KNOWN = new Set(['register', 'deposit', 'merge', 'withdraw', 'transfer']);

function storePath(assetKey = 'eurc') {
  const key = String(assetKey || 'eurc').toLowerCase();
  return join(DATA_DIR, `confidential_events_${key}.json`);
}

function loadDeployments(assetKey = 'eurc', env = process.env) {
  const key = String(assetKey || 'eurc').toLowerCase();
  const envPrefix = key === 'eurc' ? 'CONFIDENTIAL' : `CONFIDENTIAL_${key.toUpperCase()}`;
  const tokenEnv = env[`${envPrefix}_TOKEN_ID`] || (key === 'eurc' ? env.CONFIDENTIAL_TOKEN_ID : undefined);
  if (tokenEnv) {
    return {
      token: tokenEnv,
      verifier: env[`${envPrefix}_VERIFIER_ID`] || env.CONFIDENTIAL_VERIFIER_ID,
      auditor: env[`${envPrefix}_AUDITOR_ID`] || env.CONFIDENTIAL_AUDITOR_ID,
      policy: env[`${envPrefix}_POLICY_ID`] || env.CONFIDENTIAL_POLICY_ID,
      underlying: env[`${envPrefix}_UNDERLYING_ID`] || env.CONFIDENTIAL_UNDERLYING_ID,
      deployed_at_ledger: Number(
        env[`${envPrefix}_DEPLOYED_AT_LEDGER`] || env.CONFIDENTIAL_DEPLOYED_AT_LEDGER || 0,
      ),
      auditor_id: Number(env[`${envPrefix}_AUDITOR_ID_NUM`] || env.CONFIDENTIAL_AUDITOR_ID_NUM || 1),
    };
  }
  const deploymentsPath = env.DEPLOYMENTS_JSON_PATH || join(ROOT, 'deployments.json');
  const raw = readFileSync(deploymentsPath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.confidential_tokens?.[key] || (key === 'eurc' ? parsed.confidential_token : null) || null;
}

function loadStore(assetKey = 'eurc') {
  const path = storePath(assetKey);
  if (!existsSync(path)) {
    return { cursor: null, events: [], latestLedger: 0, assetKey };
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function saveStore(store, assetKey = 'eurc') {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(storePath(assetKey), JSON.stringify({ ...store, assetKey }, null, 2));
}

function rpcEventCoords(id) {
  const [toidStr, eventStr] = String(id).split('-');
  const opIndex = Number(BigInt(toidStr) & 0xfffn);
  const eventIndex = Number(eventStr ?? '0');
  return { opIndex, eventIndex };
}

function naturalEventId({ ledger, txHash, opIndex, eventIndex }) {
  return `${ledger}-${txHash}-${opIndex}-${eventIndex}`;
}

function fromBytesBE(bytes) {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) + BigInt(b);
  return v;
}

function dataField(value, name) {
  const byName = new Map();
  for (const e of value.map() ?? []) {
    byName.set(e.key().sym().toString(), e.val());
  }
  const v = byName.get(name);
  if (!v) throw new Error(`event data missing field "${name}"`);
  if (v.switch().name === 'scvBytes') return fromBytesBE(new Uint8Array(v.bytes()));
  if (v.switch().name === 'scvI128') return scValToNative(v);
  if (v.switch().name === 'scvU32') return BigInt(v.u32());
  throw new Error(`unsupported field type for ${name}`);
}

function fieldHex(value, name) {
  return `0x${dataField(value, name).toString(16)}`;
}

function pointField(value, name) {
  const byName = new Map();
  for (const e of value.map() ?? []) {
    byName.set(e.key().sym().toString(), e.val());
  }
  const v = byName.get(name);
  if (!v) throw new Error(`event data missing field "${name}"`);
  const bytes = new Uint8Array(v.bytes());
  if (bytes.length !== 64) throw new Error(`expected 64-byte point for ${name}`);
  let allZero = true;
  for (const b of bytes) {
    if (b !== 0) {
      allZero = false;
      break;
    }
  }
  if (allZero) return { x: '0x0', y: '0x0' };
  const x = fromBytesBE(bytes.subarray(0, 32));
  const y = fromBytesBE(bytes.subarray(32, 64));
  return { x: `0x${x.toString(16)}`, y: `0x${y.toString(16)}` };
}

function parseRpcEvent(ev) {
  const topics = ev.topic;
  if (!topics || topics.length === 0) return null;
  const name = topics[0].sym().toString();
  if (!KNOWN.has(name)) return null;
  const { opIndex, eventIndex } = rpcEventCoords(ev.id);
  const base = {
    ledger: ev.ledger,
    txHash: ev.txHash,
    id: naturalEventId({ ledger: ev.ledger, txHash: ev.txHash, opIndex, eventIndex }),
    type: name,
  };
  const addr = (i) => Address.fromScVal(topics[i]).toString();
  switch (name) {
    case 'register':
      return { ...base, account: addr(1), auditorId: Number(dataField(ev.value, 'auditor_id')) };
    case 'deposit':
      return {
        ...base,
        from: addr(1),
        to: addr(2),
        amount: dataField(ev.value, 'amount').toString(),
      };
    case 'merge':
      return { ...base, account: addr(1) };
    case 'withdraw':
      return {
        ...base,
        from: addr(1),
        to: addr(2),
        amount: dataField(ev.value, 'amount').toString(),
      };
    case 'transfer':
      return {
        ...base,
        from: addr(1),
        to: addr(2),
        rE: pointField(ev.value, 'r_e'),
        sigma: fieldHex(ev.value, 'sigma'),
        vTilde: fieldHex(ev.value, 'v_tilde'),
        bTilde: fieldHex(ev.value, 'b_tilde'),
        vAudR: fieldHex(ev.value, 'v_aud_r'),
        rAudR: fieldHex(ev.value, 'r_aud_r'),
        vAudS: fieldHex(ev.value, 'v_aud_s'),
        bAudS: fieldHex(ev.value, 'b_aud_s'),
      };
    default:
      return null;
  }
}

async function syncConfidentialEvents(env = process.env, assetKey = 'eurc') {
  const key = String(assetKey || 'eurc').toLowerCase();
  const deployment = loadDeployments(key, env);
  if (!deployment?.token) {
    throw new Error(`confidential token deployment missing for asset "${key}"`);
  }
  const rpcUrl = env.STELLAR_RPC_URL || env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const store = loadStore(key);
  const health = await server.getHealth();
  const oldest = health.oldestLedger ?? 1;
  const startLedger =
    deployment.deployed_at_ledger > 0
      ? Math.max(deployment.deployed_at_ledger, oldest)
      : Math.max(oldest, store.latestLedger > 0 ? store.latestLedger - 5000 : oldest);
  let pageCursor = store.cursor || undefined;
  const decoded = [...store.events];
  const seen = new Set(decoded.map((e) => e.id));
  let latestLedger = store.latestLedger || 0;

  for (;;) {
    const req = pageCursor
      ? { filters: [{ type: 'contract', contractIds: [deployment.token] }], cursor: pageCursor, limit: 100 }
      : {
          filters: [{ type: 'contract', contractIds: [deployment.token] }],
          startLedger,
          limit: 100,
        };
    const resp = await server.getEvents(req);
    latestLedger = resp.latestLedger;
    for (const ev of resp.events) {
      const parsed = parseRpcEvent(ev);
      if (parsed && !seen.has(parsed.id)) {
        seen.add(parsed.id);
        decoded.push(parsed);
      }
    }
    const prev = pageCursor;
    pageCursor = resp.cursor;
    if (!resp.cursor || resp.cursor === prev) break;
    if (Number(BigInt(resp.cursor.split('-')[0]) >> 32n) >= resp.latestLedger) break;
  }

  decoded.sort((a, b) => a.ledger - b.ledger);
  const next = { cursor: pageCursor || store.cursor, events: decoded, latestLedger, assetKey: key };
  saveStore(next, key);
  return { ingested: decoded.length, latestLedger, cursor: next.cursor, assetKey: key };
}

function listEvents(query = {}, assetKey = 'eurc') {
  const key = String(query.asset || assetKey || 'eurc').toLowerCase();
  const store = loadStore(key);
  let events = store.events;
  if (query.account) {
    const account = String(query.account);
    events = events.filter(
      (ev) =>
        ev.account === account ||
        ev.from === account ||
        ev.to === account,
    );
  }
  if (query.fromLedger) {
    const from = Number(query.fromLedger);
    events = events.filter((ev) => ev.ledger >= from);
  }
  return { events, latestLedger: store.latestLedger, cursor: store.cursor, assetKey: key };
}

module.exports = {
  loadDeployments,
  syncConfidentialEvents,
  listEvents,
};
