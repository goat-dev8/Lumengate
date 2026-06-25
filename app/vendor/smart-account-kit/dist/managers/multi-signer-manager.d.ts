/**
 * Multi-Signer Manager
 *
 * Handles multi-signature operations for smart accounts, coordinating
 * between passkey signers and external wallet signers.
 */
import { xdr } from "@stellar/stellar-sdk";
import type { Keypair, Transaction, rpc } from "@stellar/stellar-sdk";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import type { Client as SmartAccountClient, Signer as ContractSigner, ContextRuleType } from "smart-account-kit-bindings";
import type { ContractDetailsResponse } from "../indexer";
import type { ExternalSignerManager } from "../external-signers";
import type { SelectedSigner, SubmissionOptions, TransactionResult } from "../types";
export interface MultiSignerOptions {
    onLog?: (message: string, type?: "info" | "success" | "error") => void;
    forceMethod?: SubmissionOptions["forceMethod"];
    resolveContextRuleIds?: (entry: xdr.SorobanAuthorizationEntry, index: number) => number[] | Promise<number[]>;
}
export interface MultiSignerManagerDeps {
    getContractId: () => string | undefined;
    isConnected: () => boolean;
    getRules: (contextRuleType: ContextRuleType) => Promise<Array<{
        signers: ContractSigner[];
    }>>;
    getContractDetailsFromIndexer?: () => Promise<ContractDetailsResponse | null>;
    requireWallet: () => {
        wallet: SmartAccountClient;
    };
    externalSigners: ExternalSignerManager;
    rpc: rpc.Server;
    networkPassphrase: string;
    timeoutInSeconds: number;
    deployerKeypair: Keypair;
    deployerPublicKey: string;
    signAuthEntry: (entry: xdr.SorobanAuthorizationEntry, options?: {
        credentialId?: string;
        expiration?: number;
        contextRuleIds?: number[];
        signer?: ContractSigner;
    }) => Promise<xdr.SorobanAuthorizationEntry>;
    sendAndPoll: (tx: Transaction, options?: SubmissionOptions) => Promise<TransactionResult>;
    hasSourceAccountAuth: (tx: Transaction) => boolean;
    shouldUseFeeSponsoring: (options?: SubmissionOptions) => boolean;
}
export declare class MultiSignerManager {
    private deps;
    constructor(deps: MultiSignerManagerDeps);
    getAvailableSigners(): Promise<ContractSigner[]>;
    needsMultiSigner(signers: ContractSigner[]): boolean;
    buildSelectedSigners(signers: ContractSigner[], activeCredentialId?: string | null): SelectedSigner[];
    private signWalletAddressAuthEntry;
    private submitWithSelectedSigners;
    operation<T>(assembledTx: AssembledTransaction<T>, selectedSigners: SelectedSigner[], options?: MultiSignerOptions): Promise<TransactionResult>;
    transfer(tokenContract: string, recipient: string, amount: number, selectedSigners: SelectedSigner[], options?: MultiSignerOptions): Promise<TransactionResult>;
}
//# sourceMappingURL=multi-signer-manager.d.ts.map