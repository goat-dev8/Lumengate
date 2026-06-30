/**
 * Register a Stellar account on the Lumengate confidential EURC wrapper (real proof + tx).
 * Usage: node scripts/ct_register_account.mjs <SECRET_KEY> [account_address]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Keypair,
  Contract,
  TransactionBuilder,
  rpc,
  nativeToScVal,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { addressToField } from '../src/lib/confidentialToken/crypto/address.ts';
import { generateKeys } from '../src/lib/confidentialToken/crypto/keys.ts';
import { buildRegisterWitness } from '../src/lib/confidentialToken/witness/register.ts';
import { encodeRegisterData } from '../src/lib/confidentialToken/chain/payload.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..', '..');
const deployments = JSON.parse(readFileSync(join(root, 'deployments.json'), 'utf8'));
const ct = deployments.confidential_token;
if (!ct?.token) throw new Error('confidential_token missing in deployments.json');

const RPC = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';

async function proveRegister(inputs) {
  const circuit = JSON.parse(
    readFileSync(join(__dir, '..', 'public', 'confidential-circuits', 'register.json'), 'utf8'),
  );
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
  const { witness } = await noir.execute(inputs);
  const { proof } = await backend.generateProof(witness, { keccak: true });
  await backend.destroy();
  return proof;
}

async function main() {
  const secret = process.argv[2] || process.env.CT_REGISTER_SECRET;
  if (!secret) throw new Error('Provide secret key as argv[2] or CT_REGISTER_SECRET');
  const kp = Keypair.fromSecret(secret);
  const account = process.argv[3] || kp.publicKey();
  const addrF = addressToField(ct.token);
  const keys = generateKeys(addrF);
  const witness = buildRegisterWitness(keys);
  console.log('Generating register proof for', account);
  const proof = await proveRegister(witness.inputs);

  const server = new rpc.Server(RPC);
  const source = await server.getAccount(kp.publicKey());
  const contract = new Contract(ct.token);
  const tx = new TransactionBuilder(source, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'register',
        nativeToScVal(account, { type: 'address' }),
        nativeToScVal(ct.auditor_id ?? 1, { type: 'u32' }),
        encodeRegisterData(witness, proof),
      ),
    )
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`simulate failed: ${sim.error}`);
  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(kp);
  const send = await server.sendTransaction(assembled);
  if (send.status === 'ERROR') throw new Error(JSON.stringify(send.errorResult));
  console.log('Submitted:', send.hash);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await server.getTransaction(send.hash);
    if (res.status === rpc.Api.GetTransactionStatus.NOT_FOUND) continue;
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error('register failed on-chain');
    console.log('Registered', account);
    return;
  }
  throw new Error('timeout');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
