const {
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} = require('@stellar/stellar-sdk');

function normalizeHex32(hex) {
  return String(hex || '').replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

function hex32ToBuffer(hex) {
  return Buffer.from(normalizeHex32(hex), 'hex');
}

function bytesN32ScVal(hex) {
  return xdr.ScVal.scvBytes(hex32ToBuffer(hex));
}

function getNetworkConfig(env = process.env) {
  const rpcUrl = env.STELLAR_RPC_URL || env.VITE_STELLAR_RPC_URL;
  const passphrase = env.STELLAR_NETWORK_PASSPHRASE || env.VITE_NETWORK_PASSPHRASE;
  if (!rpcUrl || !passphrase) {
    throw new Error('Missing STELLAR_RPC_URL or STELLAR_NETWORK_PASSPHRASE');
  }
  return { rpcUrl, passphrase };
}

function adminKeypair(env = process.env) {
  const secret = env.CONTRACT_ADMIN_SECRET_KEY;
  if (!secret) throw new Error('Missing CONTRACT_ADMIN_SECRET_KEY');
  return Keypair.fromSecret(secret);
}

async function waitForTransactionSuccess(hash, env = process.env, maxWaitMs = 120000) {
  const horizon = env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(`${horizon}/transactions/${hash}`);
    if (res.ok) {
      const body = await res.json();
      if (body.successful) return hash;
      throw new Error(`Transaction ${hash} failed on ledger`);
    }
    if (res.status !== 404) {
      const detail = await res.text();
      throw new Error(`Horizon lookup failed for ${hash}: ${res.status} ${detail.slice(0, 200)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Transaction ${hash} not confirmed after ${maxWaitMs}ms`);
}

async function invokeAdminContract(contractId, method, scArgs, env = process.env) {
  const { rpcUrl, passphrase } = getNetworkConfig(env);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const admin = adminKeypair(env);
  const account = await server.getAccount(admin.publicKey());
  const contract = new Contract(contractId);
  let tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Contract simulation failed');
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(admin);
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(JSON.stringify(sent.errorResult ?? sent));
  }

  await waitForTransactionSuccess(sent.hash, env);
  return sent.hash;
}

async function syncCredentialRootOnChain(rootHex, env = process.env) {
  const registryId = env.CREDENTIAL_REGISTRY_ID || env.VITE_CREDENTIAL_REGISTRY_ID;
  const admin = env.CONTRACT_ADMIN_PUBLIC_KEY;
  if (!registryId || !admin || !env.CONTRACT_ADMIN_SECRET_KEY) return null;

  const root = normalizeHex32(rootHex);
  await invokeAdminContract(
    registryId,
    'set_root',
    [Address.fromString(admin).toScVal(), bytesN32ScVal(root)],
    env,
  );
  return root;
}

async function syncNoteRootOnChain(noteRootHex, env = process.env) {
  const registryId = env.CREDENTIAL_REGISTRY_ID || env.VITE_CREDENTIAL_REGISTRY_ID;
  const admin = env.CONTRACT_ADMIN_PUBLIC_KEY;
  if (!registryId || !admin || !env.CONTRACT_ADMIN_SECRET_KEY) return null;

  const root = normalizeHex32(noteRootHex);
  await invokeAdminContract(
    registryId,
    'set_note_root',
    [Address.fromString(admin).toScVal(), bytesN32ScVal(root)],
    env,
  );
  return root;
}

async function adminSacTransfer(sacId, toAddress, amountRaw, env = process.env) {
  const { rpcUrl, passphrase } = getNetworkConfig(env);
  const admin = adminKeypair(env);
  const adminAddr = env.CONTRACT_ADMIN_PUBLIC_KEY || admin.publicKey();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(admin.publicKey());
  const sac = new Contract(sacId);
  let tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: passphrase,
  })
    .addOperation(
      sac.call(
        'transfer',
        Address.fromString(adminAddr).toScVal(),
        Address.fromString(toAddress).toScVal(),
        nativeToScVal(BigInt(amountRaw), { type: 'i128' }),
      ),
    )
    .setTimeout(180)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'SAC transfer simulation failed');
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(admin);
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(JSON.stringify(sent.errorResult ?? sent));
  }
  await waitForTransactionSuccess(sent.hash, env);
  return sent.hash;
}

async function adminMintTreasury(rwaTokenId, toAddress, amountRaw, env = process.env) {
  const admin = env.CONTRACT_ADMIN_PUBLIC_KEY;
  if (!admin) throw new Error('Missing CONTRACT_ADMIN_PUBLIC_KEY');
  return invokeAdminContract(
    rwaTokenId,
    'admin_mint',
    [
      Address.fromString(admin).toScVal(),
      Address.fromString(toAddress).toScVal(),
      nativeToScVal(BigInt(amountRaw), { type: 'i128' }),
    ],
    env,
  );
}

module.exports = {
  invokeAdminContract,
  adminSacTransfer,
  adminMintTreasury,
  normalizeHex32,
  syncCredentialRootOnChain,
  syncNoteRootOnChain,
};
