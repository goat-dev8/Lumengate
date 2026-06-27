const { Transaction, Keypair, hash, rpc } = require('@stellar/stellar-sdk');

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

/**
 * OpenZeppelin Channels rejects signed Soroban XDR when tx.fee !== minResourceFee (FEE_MISMATCH).
 * smart-account-kit may submit stale envelopes after WebAuthn delay; re-simulate + re-sign here.
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

  const server = new rpc.Server(resolveRpcUrl(env));
  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    const detail =
      typeof simulation.error === 'string'
        ? simulation.error
        : JSON.stringify(simulation.error ?? simulation);
    throw new Error(`Soroban simulation failed: ${detail}`);
  }

  const resourceFee = String(simulation.minResourceFee ?? '');
  if (resourceFee && String(tx.fee) === resourceFee) {
    return trimmed;
  }

  const rebuilt = rpc.assembleTransaction(tx, simulation).build();
  rebuilt.sign(SMART_ACCOUNT_DEPLOYER);
  return rebuilt.toXDR();
}

module.exports = {
  normalizeSignedSorobanXdr,
  SMART_ACCOUNT_DEPLOYER_PUBLIC_KEY: SMART_ACCOUNT_DEPLOYER.publicKey(),
};
