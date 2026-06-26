#!/usr/bin/env bash
# Parse contract events from getTransaction (runtime verification helper).
set -euo pipefail

TX="${1:?tx hash required}"
RPC="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"

node --input-type=module - "$TX" "$RPC" <<'NODE'
import { xdr as X } from '@stellar/stellar-sdk';

const tx = process.argv[2];
const rpc = process.argv[3];

const res = await fetch(rpc, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: { hash: tx },
  }),
});
const j = await res.json();
if (j.error) {
  throw new Error(`RPC error: ${JSON.stringify(j.error)}`);
}
if (!j.result) {
  throw new Error(`Transaction not found or archived: ${tx}`);
}

const r = j.result;
console.log('status', r.status, 'ledger', r.ledger);
const groups = r.events?.contractEventsXdr ?? [];
let count = 0;
for (const group of groups) {
  for (const eventXdr of group) {
    count++;
    const ev = X.ContractEvent.fromXDR(eventXdr, 'base64');
    const topics = ev.body().v0().topics();
    const sym = topics[0]?.sym?.()?.toString?.() ?? String(topics[0]?.value?.());
    const cid = ev.contractId()?.toString('hex')?.toUpperCase?.() ?? '?';
    console.log(' event', count, 'contract', cid?.slice(0, 8), 'topic', sym);
  }
}
console.log('contract_events', count);
NODE
