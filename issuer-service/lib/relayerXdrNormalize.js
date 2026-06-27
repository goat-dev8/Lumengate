const {
  Transaction,
  TransactionBuilder,
  Keypair,
  hash,
  rpc,
  Operation,
  Account,
} = require('@stellar/stellar-sdk');

/** Same deterministic deployer as smart-account-kit (public, not user wallet). */
const SMART_ACCOUNT_DEPLOYER = Keypair.fromRawEd25519Seed(
  hash(Buffer.from('openzeppelin-smart-account-kit')),
);

function resolveRpcUrl(env = process.env) {
  return String(
    env.STELLAR_RPC_URL || env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  ).trim();
}

function resolveNetworkPassphrase(env = process.env) {
  return String(
    env.STELLAR_NETWORK_PASSPHRASE ||
      env.VITE_NETWORK_PASSPHRASE ||
      'Test SDF Network ; September 2015',
  ).trim();
}

function isSorobanInvokeTx(tx) {
  return tx.operations.some((op) => op.type === 'invokeHostFunction');
}

function feesAlignedWithSorobanResource(tx) {
  try {
    const sorobanData = tx.toEnvelope().v1().tx().ext().value();
    if (!sorobanData) return false;
    return String(tx.fee) === sorobanData.resourceFee().toString();
  } catch {
    return false;
  }
}

/**
 * OpenZeppelin Channels validates signed Soroban XDR with:
 *   tx.fee === sorobanData.resourceFee (no classic fee component).
 * smart-account-kit assembleTransaction sets fee = classic + resource; re-build here.
 */
async function normalizeSignedSorobanXdr(xdrBase64, env = process.env) {
  const trimmed = String(xdrBase64 || '').trim();
  if (!trimmed) return trimmed;

  const networkPassphrase = resolveNetworkPassphrase(env);
  let tx;
  try {
    tx = new Transaction(trimmed, networkPassphrase);
  } catch {
    return trimmed;
  }

  if (!isSorobanInvokeTx(tx)) {
    return trimmed;
  }

  const deployerPk = SMART_ACCOUNT_DEPLOYER.publicKey();
  if (tx.source !== deployerPk) {
    return trimmed;
  }

  if (feesAlignedWithSorobanResource(tx)) {
    return trimmed;
  }

  const server = new rpc.Server(resolveRpcUrl(env));
  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    const detail =
      typeof simulation.error === 'string'
        ? simulation.error
        : JSON.stringify(simulation.error ?? simulation);
    throw new Error(`Soroban simulation failed: ${detail}`);
  }

  const assembled = rpc.assembleTransaction(tx, simulation).build();
  const sorobanData = assembled.toEnvelope().v1().tx().ext().value();
  if (!sorobanData) {
    throw new Error('Assembled Soroban transaction is missing extension data');
  }

  const invokeOp = assembled.operations[0];
  if (invokeOp.type !== 'invokeHostFunction') {
    throw new Error('Expected invokeHostFunction operation');
  }

  const sequenceNum = (BigInt(assembled.sequence) - 1n).toString();
  const source = new Account(assembled.source, sequenceNum);
  const builder = new TransactionBuilder(source, {
    fee: '0',
    networkPassphrase,
    sorobanData,
    memo: assembled.memo,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: invokeOp.func,
        auth: invokeOp.auth ?? [],
        source: invokeOp.source,
      }),
    )
    .setTimeout(30);

  const realigned = builder.build();

  if (!feesAlignedWithSorobanResource(realigned)) {
    throw new Error('Failed to align Soroban transaction fee with resource fee');
  }

  realigned.sign(SMART_ACCOUNT_DEPLOYER);
  return realigned.toXDR();
}

module.exports = {
  normalizeSignedSorobanXdr,
  SMART_ACCOUNT_DEPLOYER_PUBLIC_KEY: SMART_ACCOUNT_DEPLOYER.publicKey(),
};
