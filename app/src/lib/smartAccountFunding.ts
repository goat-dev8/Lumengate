import {
  Contract,
  nativeToScVal,
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

/** Move native XLM SAC from the connected G-wallet into a smart account (C-address). */
export async function buildFundSmartAccountXlmXdr(
  config: DeploymentConfig,
  sourceWallet: string,
  smartAccountAddress: string,
  amountXlm: string,
): Promise<string> {
  const sacId = config.nativeSacId;
  if (!sacId) {
    throw new Error('Native XLM SAC not configured. Set VITE_NATIVE_SAC_ID.');
  }
  const amountRaw = parseStellarAmount(amountXlm);
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
