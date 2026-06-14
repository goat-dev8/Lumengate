import { xdr } from '@stellar/stellar-sdk';

const RPC = 'https://soroban-testnet.stellar.org';
const TX = '7e4da0559644b01f46bb952a7c7fa795e912cbf3ce9916b0e54faac1f3f01dde';

const res = await fetch(RPC, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash: TX } }),
});
const json = await res.json();
const result = json.result;
if (!result || result.status !== 'SUCCESS') {
  console.error('TX not found', json);
  process.exit(1);
}

const topics = [];
const nested = result.events?.contractEventsXdr ?? [];
for (const group of nested) {
  for (const b64 of group) {
    const ev = xdr.ContractEvent.fromXDR(b64, 'base64');
    if (ev.body().switch() !== 0) continue;
    const t = ev.body().v0().topics();
    const first = t[0];
    if (first.switch() === xdr.ScValType.scvSymbol()) {
      topics.push(first.sym().toString());
    }
  }
}
console.log('topics:', topics);
if (!topics.includes('transfer_gated')) process.exit(1);
console.log('OK');
