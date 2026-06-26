#!/usr/bin/env node
/**
 * Bootstrap Lumengate-controlled testnet EURC for faucet + compliant settlement.
 * Issues classic EURC from the deployer, deposits into the SAC, and seeds the treasury admin SAC balance.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import {
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  Address,
  xdr,
} from '@stellar/stellar-sdk';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function env(name) {
  const line = readFileSync(join(ROOT, '.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`Missing ${name}`);
  const raw = line.slice(name.length + 1).trim().replace(/\r$/, '');
  return raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

function setEnv(key, value) {
  const path = join(ROOT, '.env');
  const lines = readFileSync(path, 'utf8').split('\n');
  const next = lines.filter((l) => !l.startsWith(`${key}=`));
  next.push(`${key}=${value}`);
  writeFileSync(path, `${next.join('\n').replace(/\n+$/, '')}\n`);
}

const horizonUrl = env('STELLAR_HORIZON_URL');
const rpcUrl = env('STELLAR_RPC_URL');
const passphrase = env('STELLAR_NETWORK_PASSPHRASE');
const deployerSecret = env('DEPLOYER_SECRET_KEY');
const adminSecret = env('CONTRACT_ADMIN_SECRET_KEY');
const deployer = Keypair.fromSecret(deployerSecret);
const admin = Keypair.fromSecret(adminSecret);
const horizon = new Horizon.Server(horizonUrl);
const soroban = new rpc.Server(rpcUrl);

const eurcAsset = new Asset('EURC', deployer.publicKey());

async function loadAccount(publicKey) {
  try {
    return await horizon.loadAccount(publicKey);
  } catch {
    await fetch(`${env('FRIENDBOT_URL')}?addr=${publicKey}`);
    await new Promise((r) => setTimeout(r, 3000));
    return horizon.loadAccount(publicKey);
  }
}

async function submitClassic(source, ops) {
  const acct = await loadAccount(source.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: passphrase });
  ops.forEach((op) => tx.addOperation(op));
  const built = tx.setTimeout(120).build();
  built.sign(source);
  return horizon.submitTransaction(built);
}

async function readSacBalance(sacId, holder) {
  const ro = new (await import('@stellar/stellar-sdk')).Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0',
  );
  const tx = new TransactionBuilder(ro, { fee: '100000', networkPassphrase: passphrase })
    .addOperation(new Contract(sacId).call('balance', nativeToScVal(holder, { type: 'address' })))
    .setTimeout(30)
    .build();
  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return 0n;
  return BigInt(String(scValToNative(sim.result.retval)));
}

async function mintSacToAddress(sacId, toAddress, amountRaw) {
  const deployerSecret = env('DEPLOYER_SECRET_KEY');
  const issuer = env('VITE_EURC_ISSUER');
  const deployer = Keypair.fromSecret(deployerSecret);
  if (deployer.publicKey() !== issuer) {
    throw new Error('DEPLOYER_SECRET_KEY must match VITE_EURC_ISSUER');
  }
  const account = await soroban.getAccount(deployer.publicKey());
  const sac = new Contract(sacId);
  let tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: passphrase })
    .addOperation(
      sac.call(
        'mint',
        Address.fromString(toAddress).toScVal(),
        nativeToScVal(amountRaw, { type: 'i128' }),
      ),
    )
    .setTimeout(180)
    .build();
  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'EURC SAC mint simulation failed');
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployer);
  const sent = await soroban.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(JSON.stringify(sent.errorResult ?? sent));
  return sent.hash;
}

async function ensureSacDeployed(sacId) {
  try {
    const addr = Address.fromString(sacId);
    const key = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: addr.toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      }),
    );
    const res = await soroban.getLedgerEntries(key);
    if (res.entries?.length) return;
  } catch {
    // fall through to deploy
  }
  execSync(
    `stellar contract asset deploy --asset "EURC:${deployer.publicKey()}" --source-account deployer --network testnet`,
    { stdio: 'inherit' },
  );
}

async function main() {
  const sacId = execSync(
    `stellar contract id asset --asset "EURC:${deployer.publicKey()}" --network testnet`,
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .pop()
    .trim();

  console.log('Deployer EURC issuer:', deployer.publicKey());
  console.log('EURC SAC:', sacId);

  await ensureSacDeployed(sacId);

  const adminPk = admin.publicKey();
  const depositAmount = 100_000_000n; // 10 EURC in stroops
  const adminSacBefore = await readSacBalance(sacId, adminPk);
  if (adminSacBefore < depositAmount) {
    console.log('Minting EURC SAC balance for admin treasury…');
    const hash = await mintSacToAddress(sacId, adminPk, depositAmount);
    console.log('Mint tx:', hash);
  }

  const adminSacAfter = await readSacBalance(sacId, admin.publicKey());
  console.log('Admin EURC SAC balance (stroops):', adminSacAfter.toString());

  setEnv('VITE_EURC_ISSUER', deployer.publicKey());
  setEnv('VITE_EURC_SAC_ID', sacId);
  setEnv('EURC_SAC_ID', sacId);
  setEnv('EURC_ISSUER', deployer.publicKey());

  const deployments = JSON.parse(readFileSync(join(ROOT, 'deployments.json'), 'utf8'));
  deployments.eurc_sac = sacId;
  deployments.eurc_issuer = deployer.publicKey();
  writeFileSync(join(ROOT, 'deployments.json'), `${JSON.stringify(deployments, null, 2)}\n`);

  console.log('Updated .env and deployments.json with deployer-issued EURC.');
  console.log('Next: redeploy ComplianceSacAdmin with scripts/deploy_sac_admin.sh');
}

main().catch((err) => {
  console.error(err.response?.data ?? err);
  process.exit(1);
});
