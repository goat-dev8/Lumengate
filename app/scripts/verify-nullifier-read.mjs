import {
  Contract,
  rpc,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  scValToNative,
  Keypair,
} from '@stellar/stellar-sdk';

const RPC = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';
const POLICY_VERIFIER = 'CDXQSAIMTV4I6D6SUH2ZQ2R52PUEBJQET5UT273COZJ3EAKEYPCD7XLW';
const NULLIFIER_HEX = '579553558444340488963456153468932414111302547338722990181880173877454718545';

const server = new rpc.Server(RPC);
const contract = new Contract(POLICY_VERIFIER);
const kp = Keypair.random();
const nullifierBytes = Buffer.from(NULLIFIER_HEX, 'hex');

const tx = new TransactionBuilder(kp, { fee: '100000', networkPassphrase: PASSPHRASE })
  .addOperation(
    contract.call(
      'is_nullifier_spent',
      nativeToScVal(1, { type: 'u32' }),
      xdr.ScVal.scvBytes(nullifierBytes),
    ),
  )
  .setTimeout(30)
  .build();

const sim = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim)) {
  console.error('sim error', sim.error);
  process.exit(1);
}
console.log('nullifier spent:', Boolean(scValToNative(sim.result.retval)));
