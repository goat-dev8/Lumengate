import {
  Contract,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  BASE_FEE,
  type Transaction,
} from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';
import type { SmartAccountAssembledTransaction } from './smartAccount';
import { resolvePasskeySimulationSource } from './smartAccount';
import { encodeRegisterData, encodeTransferData, encodeWithdrawData } from './confidentialToken/chain/payload';
import { readCtRegisteredOnChain } from './ctRegistration';
import type { RegisterWitness } from './confidentialToken/witness/register';
import type { TransferWitness } from './confidentialToken/witness/transfer';
import type { WithdrawWitness } from './confidentialToken/witness/withdraw';

function server(rpcUrl: string) {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
}

async function simulateAssembledTx(
  s: rpc.Server,
  draft: Transaction,
): Promise<SmartAccountAssembledTransaction> {
  const sim = await s.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Transaction simulation failed');
  }
  return { built: rpc.assembleTransaction(draft, sim).build(), simulationData: sim };
}

async function passkeySimulationAccount(config: DeploymentConfig, source: string) {
  const s = server(config.rpcUrl);
  return s.getAccount(resolvePasskeySimulationSource(source));
}

function requireCtToken(config: DeploymentConfig): string {
  if (!config.confidentialTokenId) {
    throw new Error('Confidential token wrapper not configured');
  }
  return config.confidentialTokenId;
}

export async function buildCtRegisterTransaction(
  config: DeploymentConfig,
  source: string,
  account: string,
  auditorId: number,
  witness: RegisterWitness,
  proof: Uint8Array,
): Promise<SmartAccountAssembledTransaction> {
  const tokenId = requireCtToken(config);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
  const contract = new Contract(tokenId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'register',
        nativeToScVal(account, { type: 'address' }),
        nativeToScVal(auditorId, { type: 'u32' }),
        encodeRegisterData(witness, proof),
      ),
    )
    .setTimeout(120)
    .build();
  return simulateAssembledTx(s, draft);
}

export async function buildCtDepositTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amountRaw: bigint,
): Promise<SmartAccountAssembledTransaction> {
  const tokenId = requireCtToken(config);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
  const contract = new Contract(tokenId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'deposit',
        nativeToScVal(from, { type: 'address' }),
        nativeToScVal(to, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
      ),
    )
    .setTimeout(120)
    .build();
  return simulateAssembledTx(s, draft);
}

export async function buildCtMergeTransaction(
  config: DeploymentConfig,
  source: string,
  account: string,
): Promise<SmartAccountAssembledTransaction> {
  const tokenId = requireCtToken(config);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
  const contract = new Contract(tokenId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call('merge', nativeToScVal(account, { type: 'address' })))
    .setTimeout(120)
    .build();
  return simulateAssembledTx(s, draft);
}

export async function buildCtConfidentialTransferTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  witness: TransferWitness,
  proof: Uint8Array,
): Promise<SmartAccountAssembledTransaction> {
  const tokenId = requireCtToken(config);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
  const contract = new Contract(tokenId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'confidential_transfer',
        nativeToScVal(from, { type: 'address' }),
        nativeToScVal(to, { type: 'address' }),
        encodeTransferData(witness, proof),
      ),
    )
    .setTimeout(120)
    .build();
  return simulateAssembledTx(s, draft);
}

export async function buildCtWithdrawTransaction(
  config: DeploymentConfig,
  source: string,
  from: string,
  to: string,
  amountRaw: bigint,
  witness: WithdrawWitness,
  proof: Uint8Array,
): Promise<SmartAccountAssembledTransaction> {
  const tokenId = requireCtToken(config);
  const s = server(config.rpcUrl);
  const acct = await passkeySimulationAccount(config, source);
  const contract = new Contract(tokenId);
  const draft = new TransactionBuilder(acct, {
    fee: String(Number(BASE_FEE) * 100),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        'withdraw',
        nativeToScVal(from, { type: 'address' }),
        nativeToScVal(to, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
        encodeWithdrawData(witness, proof),
      ),
    )
    .setTimeout(120)
    .build();
  return simulateAssembledTx(s, draft);
}

export async function readCtRegistered(
  config: DeploymentConfig,
  account: string,
): Promise<boolean> {
  return readCtRegisteredOnChain(config, account);
}
