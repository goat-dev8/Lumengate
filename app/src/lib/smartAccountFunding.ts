import {
  Asset,
  Contract,
  nativeToScVal,
  Operation,
  rpc,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';
import { parseStellarAmount } from './assetAmount';
import { resolveComplianceUsdcSacId } from './contracts';

async function buildSimulatedWalletTxXdr(
  config: DeploymentConfig,
  sourceWallet: string,
  build: (builder: TransactionBuilder) => TransactionBuilder,
): Promise<string> {
  const server = new rpc.Server(config.rpcUrl);
  const sourceAccount = await server.getAccount(sourceWallet);
  const draft = build(
    new TransactionBuilder(sourceAccount, {
      fee: '1000000',
      networkPassphrase: config.networkPassphrase,
    }),
  )
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(draft);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Funding simulation failed');
  }
  return rpc.assembleTransaction(draft, sim).build().toXDR();
}

/** Move compliance-path USDC SAC from the connected G-wallet into a smart account (C-address). */
export async function buildFundSmartAccountUsdcXdr(
  config: DeploymentConfig,
  sourceWallet: string,
  smartAccountAddress: string,
  amount: string,
): Promise<string> {
  const sacId = await resolveComplianceUsdcSacId(config);
  const amountRaw = parseStellarAmount(amount);
  return buildSimulatedWalletTxXdr(config, sourceWallet, (builder) => {
    const sac = new Contract(sacId);
    return builder.addOperation(
      sac.call(
        'transfer',
        nativeToScVal(sourceWallet, { type: 'address' }),
        nativeToScVal(smartAccountAddress, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
      ),
    );
  });
}

/** Send native XLM from the connected wallet to the smart account for contract fees/reserve. */
export async function buildFundSmartAccountXlmXdr(
  config: DeploymentConfig,
  sourceWallet: string,
  smartAccountAddress: string,
  amountXlm: string,
): Promise<string> {
  const trimmed = amountXlm.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed) || Number(trimmed) <= 0) {
    throw new Error('Enter a valid XLM amount.');
  }
  return buildSimulatedWalletTxXdr(config, sourceWallet, (builder) =>
    builder.addOperation(
      Operation.payment({
        destination: smartAccountAddress,
        asset: Asset.native(),
        amount: trimmed,
      }),
    ),
  );
}
