/**
 * Credential Manager
 *
 * Manages WebAuthn credentials (passkeys) including creation, storage,
 * deployment, and synchronization with on-chain state.
 */
import type { rpc } from "@stellar/stellar-sdk";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import type { SmartAccountEventEmitter } from "../events";
import type { StorageAdapter, StoredCredential, SubmissionMethod, SubmissionOptions, TransactionResult } from "../types";
/** Dependencies required by CredentialManager */
export interface CredentialManagerDeps {
    /** Storage adapter for credentials */
    storage: StorageAdapter;
    /** RPC server for checking on-chain state */
    rpc: rpc.Server;
    /** Event emitter */
    events: SmartAccountEventEmitter;
    /** Relying party name for WebAuthn */
    rpName: string;
    /** Get current contract ID (if connected) */
    getContractId: () => string | undefined;
    /** Set contract ID and credential ID after deployment */
    setConnectedState: (contractId: string, credentialId: string) => void;
    /** Initialize wallet client for a contract */
    initializeWallet: (contractId: string) => void;
    /** Create a passkey via WebAuthn */
    createPasskey: (appName: string, userName: string) => Promise<{
        rawResponse: {
            response: {
                transports?: AuthenticatorTransportFuture[];
            };
        };
        credentialId: string;
        publicKey: Uint8Array;
    }>;
    /** Build a deploy transaction */
    buildDeployTransaction: (credentialIdBuffer: Buffer, publicKey: Uint8Array) => Promise<{
        built?: {
            toXDR: () => string;
        };
        signed?: {
            toXDR: () => string;
        };
    }>;
    /** Sign deploy transaction with deployer keypair (envelope signature) */
    signWithDeployer: (tx: unknown) => Promise<void>;
    /** Submit deployment transaction */
    submitDeploymentTx: (tx: unknown, credentialId: string, options?: SubmissionOptions) => Promise<TransactionResult>;
    /** Derive contract address from credential ID */
    deriveContractAddress: (credentialIdBuffer: Buffer) => string;
}
/**
 * Manages WebAuthn credentials for smart accounts.
 */
export declare class CredentialManager {
    private deps;
    constructor(deps: CredentialManagerDeps);
    /**
     * Get all stored credentials.
     */
    getAll(): Promise<StoredCredential[]>;
    /**
     * Get credentials for the current wallet.
     */
    getForWallet(): Promise<StoredCredential[]>;
    /**
     * Get credentials that are pending deployment.
     */
    getPending(): Promise<StoredCredential[]>;
    /**
     * Create a new passkey and save it to storage.
     */
    create(options?: {
        nickname?: string;
        appName?: string;
    }): Promise<StoredCredential>;
    /**
     * Save a credential to storage.
     */
    save(credential: {
        credentialId: string;
        publicKey: Uint8Array;
        nickname?: string;
        contractId?: string;
    }): Promise<StoredCredential>;
    /**
     * Deploy a wallet using an existing pending credential.
     */
    deploy(credentialId: string, options?: {
        autoSubmit?: boolean;
        forceMethod?: SubmissionMethod;
    }): Promise<{
        contractId: string;
        signedTransaction: string;
        submitResult?: TransactionResult;
    }>;
    /**
     * Sync a credential with on-chain state.
     * If deployed, removes from storage. Returns true if deployed.
     */
    sync(credentialId: string): Promise<boolean>;
    /**
     * Sync all stored credentials with on-chain state.
     */
    syncAll(): Promise<{
        deployed: number;
        pending: number;
        failed: number;
    }>;
    /**
     * Delete a pending credential.
     */
    delete(credentialId: string): Promise<void>;
}
//# sourceMappingURL=credential-manager.d.ts.map