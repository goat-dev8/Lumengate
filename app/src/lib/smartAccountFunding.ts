import {
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import type { DeploymentConfig } from './config';
import { parseStellarAmount } from './assetAmount';

/** Build an unsigned XDR to move USDC SAC from the connected G-wallet into a smart account (C-address). */
export async function buildFundSmartAccountUsdcXdr(
  config: DeploymentConfig,
  sourceWallet: string,
  smartAccountAddress: string,
  amount: string,
): Promise<string> {
  const server = new rpc.Server(config.rpcUrl);
  const sourceAccount = await server.getAccount(sourceWallet);
  const amountRaw = parseStellarAmount(amount);
  const sac = new Contract(config.usdcSacId);
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      sac.call(
        'transfer',
        nativeToScVal(sourceWallet, { type: 'address' }),
        nativeToScVal(smartAccountAddress, { type: 'address' }),
        nativeToScVal(amountRaw, { type: 'i128' }),
      ),
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}
