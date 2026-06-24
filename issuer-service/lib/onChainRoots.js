const { Contract, rpc, scValToNative, TransactionBuilder, Account } = require('@stellar/stellar-sdk');

function readOnlyLedgerAccount() {
  return new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

async function readOnChainRoots(env) {
  const rpcUrl = env.STELLAR_RPC_URL || env.VITE_STELLAR_RPC_URL;
  const passphrase = env.STELLAR_NETWORK_PASSPHRASE || env.VITE_NETWORK_PASSPHRASE;
  const registryId = env.CREDENTIAL_REGISTRY_ID || env.VITE_CREDENTIAL_REGISTRY_ID;
  if (!rpcUrl || !passphrase || !registryId) {
    throw new Error('Missing STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE, or CREDENTIAL_REGISTRY_ID');
  }

  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const contract = new Contract(registryId);
  const tx = new TransactionBuilder(readOnlyLedgerAccount(), {
    fee: '100000',
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call('get_roots'))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const val = sim.result?.retval;
  if (!val) throw new Error('No return value from get_roots');

  const tuple = scValToNative(val);
  return {
    root: `0x${bytesToHex(Buffer.from(tuple[0]))}`,
    revocationRoot: `0x${bytesToHex(Buffer.from(tuple[1]))}`,
    noteRoot: `0x${bytesToHex(Buffer.from(tuple[2] ?? Buffer.alloc(32)))}`,
  };
}

module.exports = { readOnChainRoots };
