import {
  Contract,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  Account,
  StrKey,
} from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';
import type { StoredPasskey } from './passkeys';

function server(rpcUrl: string) {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
}

function readOnlyAccount(): Account {
  return new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
}

/** Register passkey signer on LumengateSmartAccount (admin-delegated bootstrap). */
export async function registerPasskeyOnSmartAccount(params: {
  config: DeploymentConfig;
  adminSecret: string;
  passkey: StoredPasskey;
}): Promise<string> {
  const { config, adminSecret, passkey } = params;
  const smartId = config.lumengateSmartAccountId;
  const verifierId = import.meta.env.VITE_WEBAUTHN_VERIFIER_ID;
  if (!smartId || !StrKey.isValidContract(smartId)) {
    throw new Error('Lumengate smart account not configured');
  }
  if (!verifierId || !StrKey.isValidContract(String(verifierId))) {
    throw new Error('WebAuthn verifier contract not configured (VITE_WEBAUTHN_VERIFIER_ID)');
  }

  const adminKp = await import('@stellar/stellar-sdk').then((m) => m.Keypair.fromSecret(adminSecret));
  const s = server(config.rpcUrl);
  const adminAccount = await s.getAccount(adminKp.publicKey());
  const contract = new Contract(smartId);
  const tx = new TransactionBuilder(adminAccount, {
    fee: '500000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'add_passkey',
        nativeToScVal(adminKp.publicKey(), { type: 'address' }),
        nativeToScVal(String(verifierId), { type: 'address' }),
        xdr.ScVal.scvBytes(Buffer.from(passkey.keyDataHex, 'hex')),
      ),
    )
    .setTimeout(120)
    .build();

  tx.sign(adminKp);
  const sent = await s.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(`Passkey registration failed: ${sent.status}`);
  }
  return sent.hash;
}

export async function bindSessionProof(params: {
  config: DeploymentConfig;
  adminSecret: string;
  proofHex: string;
  publicInputsHex: string;
}): Promise<string> {
  const { config, adminSecret, proofHex, publicInputsHex } = params;
  const smartId = config.lumengateSmartAccountId;
  const policyId = config.compliancePolicyId;
  if (!smartId || !policyId) throw new Error('Smart account or compliance policy not configured');

  const adminKp = await import('@stellar/stellar-sdk').then((m) => m.Keypair.fromSecret(adminSecret));
  const s = server(config.rpcUrl);
  const adminAccount = await s.getAccount(adminKp.publicKey());
  const contract = new Contract(smartId);
  const tx = new TransactionBuilder(adminAccount, {
    fee: '500000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'bind_session_proof',
        nativeToScVal(smartId, { type: 'address' }),
        nativeToScVal(policyId, { type: 'address' }),
        xdr.ScVal.scvBytes(Buffer.from(proofHex, 'hex')),
        xdr.ScVal.scvBytes(Buffer.from(publicInputsHex, 'hex')),
      ),
    )
    .setTimeout(120)
    .build();

  tx.sign(adminKp);
  const sent = await s.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(`bind_session_proof failed: ${sent.status}`);
  }
  return sent.hash;
}

export async function readSmartAccountContextRules(config: DeploymentConfig): Promise<number> {
  const smartId = config.lumengateSmartAccountId;
  if (!smartId) return 0;
  const s = server(config.rpcUrl);
  const contract = new Contract(smartId);
  const tx = new TransactionBuilder(readOnlyAccount(), {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('get_context_rules_count'))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const val = sim.result?.retval;
  if (!val) return 0;
  return Number(val.u32());
}
