import { contract, rpc } from "@stellar/stellar-sdk";
import { Keypair, Transaction, xdr } from "@stellar/stellar-sdk";
import type { SubmissionMethod, SubmissionOptions, TransactionResult } from "../types";
import type { RelayerClient } from "../relayer";
import type { Client as SmartAccountClient } from "smart-account-kit-bindings";
type ResolveContextRuleIds = (entry: xdr.SorobanAuthorizationEntry, index: number) => number[] | Promise<number[]>;
export declare function getSubmissionMethod(relayer: RelayerClient | null, options?: SubmissionOptions): SubmissionMethod;
export declare function shouldUseFeeSponsoring(relayer: RelayerClient | null, options?: SubmissionOptions): boolean;
export declare function sendAndPoll(deps: {
    rpc: rpc.Server;
    relayer: RelayerClient | null;
}, transaction: Transaction, options?: SubmissionOptions): Promise<TransactionResult>;
export declare function hasSourceAccountAuth(transaction: Transaction): boolean;
export declare function buildTokenTransferHostFunction(tokenContract: string, fromAddress: string, toAddress: string, amountInStroops: bigint): xdr.HostFunction;
export declare function buildTokenTransferTargetArgs(wallet: SmartAccountClient | {
    spec?: {
        nativeToScVal?: (val: unknown, type: xdr.ScSpecTypeDef) => xdr.ScVal;
    };
}, fromAddress: string, toAddress: string, amountInStroops: bigint): xdr.ScVal[];
export declare function simulateHostFunction(deps: {
    rpc: rpc.Server;
    networkPassphrase: string;
    timeoutInSeconds: number;
    deployerKeypair: Keypair;
}, hostFunc: xdr.HostFunction): Promise<{
    authEntries: xdr.SorobanAuthorizationEntry[];
}>;
export declare function signResimulateAndPrepare(deps: {
    rpc: rpc.Server;
    networkPassphrase: string;
    timeoutInSeconds: number;
    deployerKeypair: Keypair;
    signAuthEntry: (entry: xdr.SorobanAuthorizationEntry, options?: {
        credentialId?: string;
        expiration?: number;
        contextRuleIds?: number[];
    }) => Promise<xdr.SorobanAuthorizationEntry>;
}, hostFunc: xdr.HostFunction, authEntries: xdr.SorobanAuthorizationEntry[], options?: {
    credentialId?: string;
    expiration?: number;
    resolveContextRuleIds?: ResolveContextRuleIds;
}): Promise<Transaction>;
export declare function sign(deps: {
    getContractId: () => string | undefined;
    getCredentialId: () => string | undefined;
    calculateExpiration: () => Promise<number>;
    signAuthEntry: (entry: xdr.SorobanAuthorizationEntry, options?: {
        credentialId?: string;
        expiration?: number;
        contextRuleIds?: number[];
    }) => Promise<xdr.SorobanAuthorizationEntry>;
}, transaction: contract.AssembledTransaction<unknown>, options?: {
    credentialId?: string;
    expiration?: number;
    resolveContextRuleIds?: ResolveContextRuleIds;
}): Promise<contract.AssembledTransaction<unknown>>;
export declare function signAndSubmit(deps: {
    getContractId: () => string | undefined;
    signResimulateAndPrepare: (hostFunc: xdr.HostFunction, authEntries: xdr.SorobanAuthorizationEntry[], options?: {
        credentialId?: string;
        expiration?: number;
        resolveContextRuleIds?: ResolveContextRuleIds;
    }) => Promise<Transaction>;
    shouldUseFeeSponsoring: (options?: SubmissionOptions) => boolean;
    hasSourceAccountAuth: (transaction: Transaction) => boolean;
    sendAndPoll: (transaction: Transaction, options?: SubmissionOptions) => Promise<TransactionResult>;
    deployerKeypair: Keypair;
}, transaction: contract.AssembledTransaction<unknown>, options?: {
    credentialId?: string;
    expiration?: number;
    forceMethod?: SubmissionMethod;
    resolveContextRuleIds?: ResolveContextRuleIds;
}): Promise<TransactionResult>;
export declare function fundWallet(deps: {
    getContractId: () => string | undefined;
    rpc: rpc.Server;
    networkPassphrase: string;
    timeoutInSeconds: number;
    shouldUseFeeSponsoring: (options?: SubmissionOptions) => boolean;
    hasSourceAccountAuth: (transaction: Transaction) => boolean;
    sendAndPoll: (transaction: Transaction, options?: SubmissionOptions) => Promise<TransactionResult>;
}, nativeTokenContract: string, options?: {
    forceMethod?: SubmissionMethod;
}): Promise<TransactionResult & {
    amount?: number;
}>;
export {};
//# sourceMappingURL=tx-ops.d.ts.map