const {
  Address,
  Asset,
  Contract,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  rpc,
  scValToNative,
} = require('@stellar/stellar-sdk');
const { getNetworkConfig, adminKeypair, waitForTransactionSuccess } = require('./sorobanAdmin');

function isMissingBalanceError(message) {
  return String(message || '').includes('MissingValue');
}

async function readSacBalanceRaw(sacId, holder, env = process.env) {
  const { rpcUrl, passphrase } = getNetworkConfig(env);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const ro = new (require('@stellar/stellar-sdk').Account)(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0',
  );
  const tx = new TransactionBuilder(ro, { fee: '100000', networkPassphrase: passphrase })
    .addOperation(new Contract(sacId).call('balance', nativeToScVal(holder, { type: 'address' })))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    if (isMissingBalanceError(sim.error)) return 0n;
    throw new Error(sim.error || 'SAC balance read failed');
  }
  return BigInt(String(scValToNative(sim.result.retval)));
}

function fundingCandidates(env = process.env) {
  const rows = [];
  const adminPk = env.CONTRACT_ADMIN_PUBLIC_KEY;
  const adminSecret = env.CONTRACT_ADMIN_SECRET_KEY;
  if (adminPk && adminSecret) {
    rows.push({ label: 'admin', publicKey: adminPk, secret: adminSecret });
  }
  if (env.DEPLOYER_SECRET_KEY) {
    const deployer = Keypair.fromSecret(env.DEPLOYER_SECRET_KEY);
    rows.push({ label: 'deployer', publicKey: deployer.publicKey(), secret: env.DEPLOYER_SECRET_KEY });
  }
  if (env.ISSUER_STELLAR_SECRET) {
    const issuer = Keypair.fromSecret(env.ISSUER_STELLAR_SECRET);
    rows.push({ label: 'issuer', publicKey: issuer.publicKey(), secret: env.ISSUER_STELLAR_SECRET });
  }
  if (env.ELIGIBLE_WALLET_SECRET) {
    const eligible = Keypair.fromSecret(env.ELIGIBLE_WALLET_SECRET);
    rows.push({ label: 'eligible', publicKey: eligible.publicKey(), secret: env.ELIGIBLE_WALLET_SECRET });
  }
  return rows;
}

async function sacTransferFromKeypair(sacId, fromPublicKey, secret, toAddress, amountRaw, env = process.env) {
  const { rpcUrl, passphrase } = getNetworkConfig(env);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const signer = Keypair.fromSecret(secret);
  if (signer.publicKey() !== fromPublicKey) {
    throw new Error('Funding secret does not match source address');
  }
  const account = await server.getAccount(fromPublicKey);
  const sac = new Contract(sacId);
  let tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: passphrase,
  })
    .addOperation(
      sac.call(
        'transfer',
        Address.fromString(fromPublicKey).toScVal(),
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
  tx.sign(signer);
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(JSON.stringify(sent.errorResult ?? sent));
  }
  await waitForTransactionSuccess(sent.hash, env);
  return sent.hash;
}

async function pickSacFunder(sacId, amountRaw, env = process.env) {
  const needed = BigInt(amountRaw);
  for (const candidate of fundingCandidates(env)) {
    const balance = await readSacBalanceRaw(sacId, candidate.publicKey, env);
    if (balance >= needed) {
      return candidate;
    }
  }
  return null;
}

async function loadHorizonAccount(horizon, publicKey, friendbotUrl) {
  try {
    return await horizon.loadAccount(publicKey);
  } catch {
    if (!friendbotUrl) throw new Error(`Account ${publicKey} is unfunded`);
    await fetch(`${friendbotUrl}?addr=${publicKey}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return horizon.loadAccount(publicKey);
  }
}

async function submitClassic(sourceSecret, ops, env = process.env) {
  const horizonUrl = env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const passphrase = env.STELLAR_NETWORK_PASSPHRASE || env.VITE_NETWORK_PASSPHRASE;
  const friendbotUrl = env.FRIENDBOT_URL;
  const source = Keypair.fromSecret(sourceSecret);
  const horizon = new Horizon.Server(horizonUrl);
  const account = await loadHorizonAccount(horizon, source.publicKey(), friendbotUrl);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase });
  ops.forEach((op) => tx.addOperation(op));
  const built = tx.setTimeout(120).build();
  built.sign(source);
  return horizon.submitTransaction(built);
}

async function depositClassicToSac(sacId, holderSecret, amountRaw, env = process.env) {
  const { rpcUrl, passphrase } = getNetworkConfig(env);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const holder = Keypair.fromSecret(holderSecret);
  const account = await server.getAccount(holder.publicKey());
  const sac = new Contract(sacId);
  let tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: passphrase,
  })
    .addOperation(
      sac.call(
        'deposit',
        Address.fromString(holder.publicKey()).toScVal(),
        nativeToScVal(BigInt(amountRaw), { type: 'i128' }),
      ),
    )
    .setTimeout(180)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'SAC deposit simulation failed');
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(holder);
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(JSON.stringify(sent.errorResult ?? sent));
  }
  await waitForTransactionSuccess(sent.hash, env);
  return sent.hash;
}

async function mintSacToAddress(sacId, toAddress, amountRaw, env = process.env) {
  const issuer = env.VITE_EURC_ISSUER || env.EURC_ISSUER;
  const deployerSecret = env.DEPLOYER_SECRET_KEY;
  if (!issuer || !deployerSecret) {
    throw new Error('Deployer EURC issuer not configured');
  }
  const deployer = Keypair.fromSecret(deployerSecret);
  if (deployer.publicKey() !== issuer) {
    throw new Error('DEPLOYER_SECRET_KEY must match VITE_EURC_ISSUER for SAC mint bootstrap');
  }
  const { rpcUrl, passphrase } = getNetworkConfig(env);
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const account = await server.getAccount(deployer.publicKey());
  const sac = new Contract(sacId);
  let tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: passphrase,
  })
    .addOperation(
      sac.call(
        'mint',
        Address.fromString(toAddress).toScVal(),
        nativeToScVal(BigInt(amountRaw), { type: 'i128' }),
      ),
    )
    .setTimeout(180)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'SAC mint simulation failed');
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployer);
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(JSON.stringify(sent.errorResult ?? sent));
  }
  await waitForTransactionSuccess(sent.hash, env);
  return sent.hash;
}

async function ensureDeployerIssuedEurcLiquidity(sacId, minRaw, env = process.env) {
  const issuer = env.VITE_EURC_ISSUER || env.EURC_ISSUER;
  const adminPk = env.CONTRACT_ADMIN_PUBLIC_KEY;
  if (!issuer || !adminPk || !env.DEPLOYER_SECRET_KEY) return false;

  const deployer = Keypair.fromSecret(env.DEPLOYER_SECRET_KEY);
  if (deployer.publicKey() !== issuer) return false;

  const adminSac = await readSacBalanceRaw(sacId, adminPk, env);
  if (adminSac >= BigInt(minRaw)) return true;

  const target = BigInt(minRaw) * 20n;
  await mintSacToAddress(sacId, adminPk, String(target), env);
  return true;
}

async function ensureSacFaucetLiquidity(sacId, amountRaw, assetLabel, env = process.env) {
  const funder = await pickSacFunder(sacId, amountRaw, env);
  if (funder) return funder;

  const eurcSac = env.VITE_EURC_SAC_ID || env.EURC_SAC_ID;
  if (assetLabel === 'EURC' && sacId === eurcSac) {
    const bootstrapped = await ensureDeployerIssuedEurcLiquidity(sacId, amountRaw, env);
    if (bootstrapped) {
      const retry = await pickSacFunder(sacId, amountRaw, env);
      if (retry) return retry;
    }
  }

  throw new Error(
    `${assetLabel} faucet treasury is empty on SAC ${sacId}. Fund CONTRACT_ADMIN with ${assetLabel} on this SAC, or configure deployer-issued EURC.`,
  );
}

async function sacTransferForFaucet(sacId, toAddress, amountRaw, assetLabel, env = process.env) {
  const funder = await ensureSacFaucetLiquidity(sacId, amountRaw, assetLabel, env);
  return sacTransferFromKeypair(sacId, funder.publicKey, funder.secret, toAddress, amountRaw, env);
}

module.exports = {
  ensureDeployerIssuedEurcLiquidity,
  ensureSacFaucetLiquidity,
  fundingCandidates,
  mintSacToAddress,
  pickSacFunder,
  readSacBalanceRaw,
  sacTransferForFaucet,
  sacTransferFromKeypair,
};
