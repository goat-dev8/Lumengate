const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { rpc, xdr, Address, scValToNative } = require('@stellar/stellar-sdk');

const ROOT = join(__dirname, '..', '..');
const STORE_PATH = join(__dirname, '..', 'data', 'confidential_events.json');

const KNOWN = new Set(['register', 'deposit', 'merge', 'withdraw', 'transfer']);

function loadDeployments() {
  if (process.env.CONFIDENTIAL_TOKEN_ID) {
    return {
      token: process.env.CONFIDENTIAL_TOKEN_ID,
      verifier: process.env.CONFIDENTIAL_VERIFIER_ID,
      auditor: process.env.CONFIDENTIAL_AUDITOR_ID,
      policy: process.env.CONFIDENTIAL_POLICY_ID,
      underlying: process.env.CONFIDENTIAL_UNDERLYING_ID,
      deployed_at_ledger: Number(process.env.CONFIDENTIAL_DEPLOYED_AT_LEDGER || 0),
      auditor_id: Number(process.env.CONFIDENTIAL_AUDITOR_ID_NUM || 1),
    };
  }
  const deploymentsPath =
    process.env.DEPLOYMENTS_JSON_PATH || join(ROOT, 'deployments.json');
  const raw = readFileSync(deploymentsPath, 'utf8');
  return JSON.parse(raw).confidential_token || null;
}

function loadStore() {
  if (!existsSync(STORE_PATH)) {
    return { cursor: null, events: [], latestLedger: 0 };
  }
  return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
}

function saveStore(store) {
  mkdirSync(join(__dirname, '..', 'data'), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
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
        sigma: `0x${dataField(ev.value, 'sigma').toString(16)}`,
      };
    default:
      return null;
  }
}

async function syncConfidentialEvents(env = process.env) {
  const deployment = loadDeployments();
  if (!deployment?.token) {
    throw new Error('confidential_token deployment missing from deployments.json');
  }
  const rpcUrl = env.STELLAR_RPC_URL || env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const store = loadStore();
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
  const next = { cursor: pageCursor || store.cursor, events: decoded, latestLedger };
  saveStore(next);
  return { ingested: decoded.length, latestLedger, cursor: next.cursor };
}

function listEvents(query = {}) {
  const store = loadStore();
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
  return { events, latestLedger: store.latestLedger, cursor: store.cursor };
}

module.exports = {
  loadDeployments,
  syncConfidentialEvents,
  listEvents,
};
