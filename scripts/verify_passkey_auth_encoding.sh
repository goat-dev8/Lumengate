#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"
node --input-type=module -e "
import { Address, xdr, Contract, rpc, TransactionBuilder, nativeToScVal, BASE_FEE, Operation } from '@stellar/stellar-sdk';
import fs from 'fs';
const dep = JSON.parse(fs.readFileSync('../deployments.json','utf8'));
function buildAuthPayloadMap(webauthnVerifier, keyData) {
  const sigEntries = [
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('authenticator_data'), val: xdr.ScVal.scvBytes(Buffer.alloc(37, 2)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('client_data'), val: xdr.ScVal.scvBytes(Buffer.from('test')) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('signature'), val: xdr.ScVal.scvBytes(Buffer.alloc(64, 3)) }),
  ];
  sigEntries.sort((a,b)=>a.key().toXDR('hex').localeCompare(b.key().toXDR('hex')));
  const signerEntry = new xdr.ScMapEntry({
    key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('External'), xdr.ScVal.scvAddress(Address.fromString(webauthnVerifier).toScAddress()), xdr.ScVal.scvBytes(keyData)]),
    val: xdr.ScVal.scvBytes(xdr.ScVal.scvMap(sigEntries).toXDR()),
  });
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('context_rule_ids'), val: xdr.ScVal.scvVec([xdr.ScVal.scvU32(0)]) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('signers'), val: xdr.ScVal.scvMap([signerEntry]) }),
  ]);
}
function buildWrongOrderAuthPayloadMap(webauthnVerifier, keyData) {
  const good = buildAuthPayloadMap(webauthnVerifier, keyData).map();
  return xdr.ScVal.scvMap([good[1], good[0]]);
}
async function resimError(signatureScVal) {
  const s = new rpc.Server('https://soroban-testnet.stellar.org');
  const acct = await s.getAccount('GAAH4OT36RRCCAGKARGPN2HLHT2NOBVFHO4GUHA6CF7UKQ4MMV24WQ4N');
  const smartAccount = 'CDONRLSIDIT7D5DN2PRQY6SR64FRBZ7MBJP5HCODFAP5M4JZ2USM6HS4';
  const c = new Contract(dep.compliance_policy);
  const tx = new TransactionBuilder(acct, { fee: String(Number(BASE_FEE)*100), networkPassphrase: 'Test SDF Network ; September 2015' })
    .addOperation(c.call('set_session_proof', nativeToScVal(smartAccount,{type:'address'}), xdr.ScVal.scvBytes(Buffer.alloc(14592)), xdr.ScVal.scvBytes(Buffer.alloc(192))))
    .setTimeout(120).build();
  const sim = await s.simulateTransaction(tx);
  const entry = xdr.SorobanAuthorizationEntry.fromXDR(sim.result.auth[0].toXDR());
  entry.credentials().address().signatureExpirationLedger(sim.latestLedger + 1000);
  entry.credentials().address().signature(signatureScVal);
  const invokeOp = tx.operations[0];
  const resimTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: 'Test SDF Network ; September 2015' })
    .addOperation(Operation.invokeHostFunction({ func: invokeOp.func, auth: [entry] }))
    .setTimeout(120).build();
  const resim = await s.simulateTransaction(resimTx);
  return resim.error ?? 'OK';
}
const mapPayload = buildAuthPayloadMap(dep.webauthn_verifier, Buffer.alloc(81,1));
const wrongOrderPayload = buildWrongOrderAuthPayloadMap(dep.webauthn_verifier, Buffer.alloc(81,1));
const mapErr = await resimError(mapPayload);
const wrongOrderErr = await resimError(wrongOrderPayload);
if (mapErr.includes('Error(Object, InvalidInput)')) throw new Error('canonical raw AuthPayload map must not be Object InvalidInput: '+mapErr);
if (!wrongOrderErr.includes('Error(Object, InvalidInput)')) throw new Error('wrong map order should be Object InvalidInput: '+wrongOrderErr);
console.log('PASS passkey auth payload uses canonical raw map order');
"
