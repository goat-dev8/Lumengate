const {
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  TransactionBuilder,
} = require('@stellar/stellar-sdk');

function normalizeHex32(hex) {
  return String(hex || '').replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

function hex32ToBuffer(hex) {
  return Buffer.from(normalizeHex32(hex), 'hex');
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

async function waitForTransaction(server, hash, maxWaitMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const tx = await server.getTransaction(hash);
    if (tx.status !== 'NOT_FOUND') return tx;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Transaction ${hash} not found after ${maxWaitMs}ms`);
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

  const result = await waitForTransaction(server, sent.hash);
  if (result.status !== 'SUCCESS') {
    throw new Error(`Transaction ${sent.hash} failed with status ${result.status}`);
  }
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
    [Address.fromString(admin).toScVal(), nativeToScVal(hex32ToBuffer(root), { type: 'bytes' })],
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
    [Address.fromString(admin).toScVal(), nativeToScVal(hex32ToBuffer(root), { type: 'bytes' })],
    env,
  );
  return root;
}

module.exports = {
  invokeAdminContract,
  normalizeHex32,
  syncCredentialRootOnChain,
  syncNoteRootOnChain,
};
