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
  const msg = String(message || '');
  return msg.includes('MissingValue') || msg.includes('trustline entry is missing');
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
    let balance = 0n;
    try {
      balance = await readSacBalanceRaw(sacId, candidate.publicKey, env);
    } catch {
      balance = 0n;
    }
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

function humanAmountToStroops(human) {
  const raw = String(human || '0').trim();
  const [whole, frac = ''] = raw.split('.');
  const padded = `${frac}0000000`.slice(0, 7);
  return BigInt(whole || '0') * 10000000n + BigInt(padded || '0');
}

function getUsdcAsset(env = process.env) {
  const issuer =
    env.VITE_USDC_ISSUER ||
    env.USDC_ISSUER ||
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  return new Asset('USDC', issuer);
}

function getUsdcSacId(env = process.env) {
  return env.VITE_USDC_SAC_ID || env.USDC_SAC_ID || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
}

function friendbotUrl(env = process.env) {
  return env.FRIENDBOT_URL || 'https://friendbot.stellar.org';
}

async function readClassicUsdcStroops(publicKey, env = process.env) {
  const horizonUrl = env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const usdc = getUsdcAsset(env);
  const horizon = new Horizon.Server(horizonUrl);
  const account = await loadHorizonAccount(horizon, publicKey, friendbotUrl(env));
  const row = account.balances.find(
    (balance) => balance.asset_code === 'USDC' && balance.asset_issuer === usdc.getIssuer(),
  );
  if (!row) return 0n;
  return humanAmountToStroops(row.balance);
}

async function ensureClassicUsdcOnAccount(publicKey, secret, minStroops, env = process.env) {
  const usdc = getUsdcAsset(env);
  let classic = await readClassicUsdcStroops(publicKey, env);
  if (classic >= minStroops) return classic;

  try {
    await submitClassic(secret, [Operation.changeTrust({ asset: usdc, limit: '100000000' })], env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/exists|trustline/i.test(message)) throw err;
  }

  classic = await readClassicUsdcStroops(publicKey, env);
  if (classic >= minStroops) return classic;

  for (const xlmSend of ['25', '50', '100']) {
    try {
      await submitClassic(
        secret,
        [
          Operation.pathPaymentStrictSend({
            sendAsset: Asset.native(),
            sendAmount: xlmSend,
            destination: publicKey,
            destAsset: usdc,
            destMin: '1',
          }),
        ],
        env,
      );
    } catch {
      // Try a larger path payment next.
    }
    classic = await readClassicUsdcStroops(publicKey, env);
    if (classic >= minStroops) return classic;
  }
  return classic;
}

async function depositAvailableClassicToSac(sacId, candidate, targetStroops, env = process.env) {
  let sacBalance = await readSacBalanceRaw(sacId, candidate.publicKey, env);
  if (sacBalance >= targetStroops) return sacBalance;

  for (let attempt = 0; attempt < 6 && sacBalance < targetStroops; attempt += 1) {
    const shortfall = targetStroops - sacBalance;
    await ensureClassicUsdcOnAccount(candidate.publicKey, candidate.secret, shortfall, env);
    const classic = await readClassicUsdcStroops(candidate.publicKey, env);
    if (classic <= 0n) break;
    const reserve = 10000000n; // keep 1 USDC classic for fees/trustline dust
    const depositable = classic > reserve ? classic - reserve : 0n;
    const depositAmount = depositable < shortfall ? depositable : shortfall;
    if (depositAmount <= 0n) break;
    await depositClassicToSac(sacId, candidate.secret, String(depositAmount), env);
    sacBalance = await readSacBalanceRaw(sacId, candidate.publicKey, env);
  }
  return sacBalance;
}

async function ensureUsdcSacLiquidity(sacId, amountRaw, env = process.env) {
  const needed = BigInt(amountRaw);
  const primaryPk = env.CONTRACT_ADMIN_PUBLIC_KEY;
  const ordered = fundingCandidates(env).sort((a, b) => {
    if (a.publicKey === primaryPk) return -1;
    if (b.publicKey === primaryPk) return 1;
    return 0;
  });

  for (const candidate of ordered) {
    if (!candidate.secret) continue;
    try {
      const toppedUp = await depositAvailableClassicToSac(sacId, candidate, needed, env);
      if (toppedUp >= needed) return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[faucet] USDC bootstrap skipped for ${candidate.label}: ${message.slice(0, 160)}`);
      }
    }
  }
  return false;
}

async function submitClassic(sourceSecret, ops, env = process.env) {
  const horizonUrl = env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const passphrase = env.STELLAR_NETWORK_PASSPHRASE || env.VITE_NETWORK_PASSPHRASE;
  const source = Keypair.fromSecret(sourceSecret);
  const horizon = new Horizon.Server(horizonUrl);
  const account = await loadHorizonAccount(horizon, source.publicKey(), friendbotUrl(env));
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

async function readClassicXlmStroops(publicKey, env = process.env) {
  const horizonUrl = env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const horizon = new Horizon.Server(horizonUrl);
  const account = await loadHorizonAccount(horizon, publicKey, friendbotUrl(env));
  const row = account.balances.find((balance) => balance.asset_type === 'native');
  if (!row) return 0n;
  return humanAmountToStroops(row.balance);
}

async function ensureNativeSacLiquidity(sacId, amountRaw, env = process.env) {
  const needed = BigInt(amountRaw);

  async function totalNativeLiquidity() {
    let total = 0n;
    for (const candidate of fundingCandidates(env)) {
      try {
        total += await readSacBalanceRaw(sacId, candidate.publicKey, env);
      } catch {
        // skip unfunded funder
      }
    }
    return total;
  }

  if ((await totalNativeLiquidity()) >= needed) return true;

  // Native XLM SAC balance mirrors classic XLM for G-address funders on testnet — no deposit().
  for (let round = 0; round < 24; round += 1) {
    for (const candidate of fundingCandidates(env)) {
      try {
        await fetch(`${friendbotUrl(env)}?addr=${encodeURIComponent(candidate.publicKey)}`);
      } catch {
        // Friendbot may rate-limit individual addresses.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
    if ((await totalNativeLiquidity()) >= needed) return true;
  }

  return (await totalNativeLiquidity()) >= needed;
}

async function ensureSacFaucetLiquidity(sacId, amountRaw, assetLabel, env = process.env) {
  const funder = await pickSacFunder(sacId, amountRaw, env);
  if (funder) return funder;

  const eurcSac = env.VITE_EURC_SAC_ID || env.EURC_SAC_ID;
  const usdcSac = getUsdcSacId(env);
  if (assetLabel === 'EURC' && sacId === eurcSac) {
    const bootstrapped = await ensureDeployerIssuedEurcLiquidity(sacId, amountRaw, env);
    if (bootstrapped) {
      const retry = await pickSacFunder(sacId, amountRaw, env);
      if (retry) return retry;
    }
  }

  if (assetLabel === 'USDC' && sacId === usdcSac) {
    const bootstrapped = await ensureUsdcSacLiquidity(sacId, amountRaw, env);
    if (bootstrapped) {
      const retry = await pickSacFunder(sacId, amountRaw, env);
      if (retry) return retry;
    }
  }

  const nativeSac = env.VITE_NATIVE_SAC_ID || env.NATIVE_SAC_ID;
  if (assetLabel === 'XLM' && sacId === nativeSac) {
    const bootstrapped = await ensureNativeSacLiquidity(sacId, amountRaw, env);
    if (bootstrapped) {
      const retry = await pickSacFunder(sacId, amountRaw, env);
      if (retry) return retry;
    }
  }

  throw new Error(
    `${assetLabel} faucet treasury is empty on SAC ${sacId}. Fund a faucet wallet with ${assetLabel} on this SAC, or configure issuer bootstrap keys.`,
  );
}

async function sacTransferForFaucet(sacId, toAddress, amountRaw, assetLabel, env = process.env) {
  const funder = await ensureSacFaucetLiquidity(sacId, amountRaw, assetLabel, env);
  return sacTransferFromKeypair(sacId, funder.publicKey, funder.secret, toAddress, amountRaw, env);
}

module.exports = {
  ensureDeployerIssuedEurcLiquidity,
  ensureNativeSacLiquidity,
  ensureSacFaucetLiquidity,
  ensureUsdcSacLiquidity,
  fundingCandidates,
  getUsdcSacId,
  mintSacToAddress,
  pickSacFunder,
  readClassicXlmStroops,
  readSacBalanceRaw,
  readClassicUsdcStroops,
  sacTransferForFaucet,
  sacTransferFromKeypair,
};
