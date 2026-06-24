const StellarSdk = require('@stellar/stellar-sdk');

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return String(value).trim().replace(/\r$/, '');
}

function resolveNetworkPassphrase(env) {
  const raw = requireEnv(env, 'VITE_NETWORK_PASSPHRASE');
  if (raw === 'Test' || raw === 'Test SDF Network') {
    return StellarSdk.Networks.TESTNET;
  }
  return raw;
}

async function waitForTransaction(rpcServer, hash) {
  for (let i = 0; i < 30; i += 1) {
    const status = await rpcServer.getTransaction(hash);
    if (status.status === 'SUCCESS') return;
    if (status.status === 'FAILED') throw new Error('Passkey registration failed on-chain');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('Timed out waiting for passkey registration');
}

async function registerPasskeySigner({ smartAccountId, verifierId, keyDataHex, env = process.env }) {
  if (!StellarSdk.StrKey.isValidContract(smartAccountId)) {
    throw new Error('smartAccountId must be a valid contract ID');
  }
  if (!StellarSdk.StrKey.isValidContract(verifierId)) {
    throw new Error('verifierId must be a valid contract ID');
  }
  if (!/^[0-9a-fA-F]+$/.test(keyDataHex) || keyDataHex.length < 130 || keyDataHex.length % 2 !== 0) {
    throw new Error('keyDataHex must contain passkey public key and credential ID bytes');
  }

  const adminSecret = requireEnv(env, 'CONTRACT_ADMIN_SECRET_KEY');
  const adminPublic = requireEnv(env, 'CONTRACT_ADMIN_PUBLIC_KEY');
  const rpcUrl = requireEnv(env, 'VITE_STELLAR_RPC_URL');
  const networkPassphrase = resolveNetworkPassphrase(env);
  const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
  if (adminKeypair.publicKey() !== adminPublic) {
    throw new Error('CONTRACT_ADMIN_PUBLIC_KEY does not match CONTRACT_ADMIN_SECRET_KEY');
  }

  const rpcServer = new StellarSdk.rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await rpcServer.getAccount(adminPublic);
  const contract = new StellarSdk.Contract(smartAccountId);
  const draft = new StellarSdk.TransactionBuilder(account, {
    fee: String(Number(StellarSdk.BASE_FEE) * 100),
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        'add_passkey',
        StellarSdk.nativeToScVal(adminPublic, { type: 'address' }),
        StellarSdk.nativeToScVal(verifierId, { type: 'address' }),
        StellarSdk.xdr.ScVal.scvBytes(Buffer.from(keyDataHex, 'hex')),
      ),
    )
    .setTimeout(120)
    .build();

  const sim = await rpcServer.simulateTransaction(draft);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Passkey registration simulation failed');
  }

  const tx = StellarSdk.rpc.assembleTransaction(draft, sim).build();
  tx.sign(adminKeypair);
  const sent = await rpcServer.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error('Passkey registration submission failed');
  }
  if (sent.status === 'PENDING' || sent.status === 'DUPLICATE' || sent.status === 'TRY_AGAIN_LATER') {
    await waitForTransaction(rpcServer, sent.hash);
  }
  return { txHash: sent.hash, smartAccountId, verifierId };
}

module.exports = { registerPasskeySigner };
