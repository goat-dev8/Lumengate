#!/usr/bin/env bash
# Parse contract events from getTransaction (runtime verification helper).
set -eu
TX="${1:?tx hash required}"
RPC="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
node -e "
const tx = process.argv[1];
const rpc = process.argv[2];
(async () => {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash: tx } }),
  });
  const j = await res.json();
  const r = j.result;
  console.log('status', r.status, 'ledger', r.ledger);
  const groups = r.events?.contractEventsXdr ?? [];
  let count = 0;
  for (const group of groups) {
    for (const xdr of group) {
      count++;
      const { xdr: X } = await import('@stellar/stellar-sdk');
      const ev = X.ContractEvent.fromXDR(xdr, 'base64');
      const topics = ev.body().v0().topics();
      const sym = topics[0]?.sym?.()?.toString?.() ?? String(topics[0]?.value?.());
      const cid = ev.contractId()?.toString('hex')?.toUpperCase?.() ?? '?';
      console.log(' event', count, 'contract', cid?.slice(0,8), 'topic', sym);
    }
  }
  console.log('contract_events', count);
})().catch(e => { console.error(e); process.exit(1); });
" "$TX" "$RPC"
