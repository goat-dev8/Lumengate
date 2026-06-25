import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/browser";
import { Keypair } from "@stellar/stellar-sdk";
import type { StorageAdapter, CreateWalletResult, ConnectWalletResult, TransactionResult, SubmissionOptions, SubmissionMethod } from "../types";
import type { SmartAccountEventEmitter } from "../events";
import type { contract, rpc } from "@stellar/stellar-sdk";
export declare function createWallet(deps: {
    storage: StorageAdapter;
    events: SmartAccountEventEmitter;
    deployerKeypair: Keypair;
    networkPassphrase: string;
    sessionExpiryMs: number;
    createPasskey: (appName: string, userName: string, authenticatorSelection?: {
        authenticatorAttachment?: "platform" | "cross-platform";
        residentKey?: "discouraged" | "preferred" | "required";
        userVerification?: "discouraged" | "preferred" | "required";
    }) => Promise<{
        rawResponse: RegistrationResponseJSON;
        credentialId: string;
        publicKey: Uint8Array;
    }>;
    buildDeployTransaction: (credentialIdBuffer: Buffer, publicKey: Uint8Array) => Promise<contract.AssembledTransaction<null>>;
    signWithDeployer: (tx: contract.AssembledTransaction<null>) => Promise<void>;
    submitDeploymentTx: (tx: contract.AssembledTransaction<null>, credentialId: string, options?: SubmissionOptions) => Promise<TransactionResult>;
    fundWallet: (nativeTokenContract: string, options?: {
        forceMethod?: SubmissionMethod;
    }) => Promise<TransactionResult & {
        amount?: number;
    }>;
    setConnectedState: (contractId: string, credentialId: string) => void;
}, appName: string, userName: string, options?: {
    nickname?: string;
    authenticatorSelection?: {
        authenticatorAttachment?: "platform" | "cross-platform";
        residentKey?: "discouraged" | "preferred" | "required";
        userVerification?: "discouraged" | "preferred" | "required";
    };
    autoSubmit?: boolean;
    autoFund?: boolean;
    nativeTokenContract?: string;
    forceMethod?: SubmissionMethod;
}): Promise<CreateWalletResult & {
    submitResult?: TransactionResult;
    fundResult?: TransactionResult & {
        amount?: number;
    };
}>;
export declare function connectWallet(deps: {
    storage: StorageAdapter;
    events: SmartAccountEventEmitter;
    rpId?: string;
    webAuthn: {
        startAuthentication: (args: {
            optionsJSON: PublicKeyCredentialRequestOptionsJSON;
        }) => Promise<AuthenticationResponseJSON>;
    };
    connectWithCredentials: (credentialId?: string, contractId?: string) => Promise<ConnectWalletResult>;
}, options?: {
    credentialId?: string;
    contractId?: string;
    fresh?: boolean;
    prompt?: boolean;
}): Promise<ConnectWalletResult | null>;
export declare function connectWithCredentials(deps: {
    storage: StorageAdapter;
    rpc: rpc.Server;
    deployerKeypair: Keypair;
    networkPassphrase: string;
    sessionExpiryMs: number;
    events: SmartAccountEventEmitter;
    setConnectedState: (contractId: string, credentialId: string) => void;
}, credentialId?: string, contractId?: string): Promise<ConnectWalletResult>;
export declare function disconnect(deps: {
    storage: StorageAdapter;
    events: SmartAccountEventEmitter;
    clearConnectedState: () => void;
    getContractId: () => string | undefined;
}): Promise<void>;
//# sourceMappingURL=wallet-ops.d.ts.map