/**
 * Signer Manager
 *
 * Manages signers (passkeys and delegated accounts) for context rules.
 */
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import type { Signer as ContractSigner } from "smart-account-kit-bindings";
import type { SmartAccountEventEmitter } from "../events";
import type { StorageAdapter } from "../types";
/** Dependencies required by SignerManager */
export interface SignerManagerDeps {
    /** Get the connected wallet client, throws if not connected */
    requireWallet: () => {
        wallet: {
            add_signer: (args: {
                context_rule_id: number;
                signer: ContractSigner;
            }) => Promise<AssembledTransaction<number>>;
            get_signer_id: (args: {
                signer: ContractSigner;
            }) => Promise<AssembledTransaction<number>>;
            remove_signer: (args: {
                context_rule_id: number;
                signer_id: number;
            }) => Promise<AssembledTransaction<null>>;
        };
        contractId: string;
    };
    /** Storage adapter for credentials */
    storage: StorageAdapter;
    /** Event emitter */
    events: SmartAccountEventEmitter;
    /** WebAuthn verifier contract address */
    webauthnVerifierAddress: string;
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
}
/**
 * Manages signers for smart account context rules.
 */
export declare class SignerManager {
    private deps;
    constructor(deps: SignerManagerDeps);
    /**
     * Add a new passkey signer to a context rule.
     * Creates a new WebAuthn passkey and registers it as an External signer.
     */
    addPasskey(contextRuleId: number, appName: string, userName: string, options?: {
        nickname?: string;
    }): Promise<{
        credentialId: string;
        publicKey: Uint8Array<ArrayBufferLike>;
        transaction: AssembledTransaction<number>;
    }>;
    /**
     * Add a delegated signer (Stellar account) to a context rule.
     */
    addDelegated(contextRuleId: number, publicKey: string): Promise<AssembledTransaction<number>>;
    /**
     * Remove a signer from a context rule.
     */
    remove(contextRuleId: number, signer: ContractSigner): Promise<AssembledTransaction<null>>;
}
//# sourceMappingURL=signer-manager.d.ts.map