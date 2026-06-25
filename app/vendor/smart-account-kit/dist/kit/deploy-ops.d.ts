import type { contract, rpc } from "@stellar/stellar-sdk";
import type { SubmissionOptions, TransactionResult } from "../types";
import type { RelayerClient } from "../relayer";
import type { StorageAdapter } from "../types";
import type { Keypair } from "@stellar/stellar-sdk";
export declare function submitDeploymentTx<T>(deps: {
    storage: StorageAdapter;
    rpc: rpc.Server;
    relayer: RelayerClient | null;
}, tx: contract.AssembledTransaction<T>, credentialId: string, options?: SubmissionOptions): Promise<TransactionResult>;
export declare function buildDeployTransaction(deps: {
    accountWasmHash: string;
    webauthnVerifierAddress: string;
    networkPassphrase: string;
    rpcUrl: string;
    deployerKeypair: Keypair;
    timeoutInSeconds: number;
}, credentialId: Buffer, publicKey: Uint8Array): Promise<contract.AssembledTransaction<null>>;
//# sourceMappingURL=deploy-ops.d.ts.map