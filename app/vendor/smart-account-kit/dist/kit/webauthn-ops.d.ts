import type { AuthenticationResponseJSON, RegistrationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { rpc, xdr } from "@stellar/stellar-sdk";
import type { StorageAdapter } from "../types";
import type { Client as SmartAccountClient, Signer as ContractSigner } from "smart-account-kit-bindings";
type WebAuthnDeps = {
    rpId?: string;
    rpName: string;
    webAuthn: {
        startRegistration: (args: {
            optionsJSON: PublicKeyCredentialCreationOptionsJSON;
        }) => Promise<RegistrationResponseJSON>;
        startAuthentication: (args: {
            optionsJSON: PublicKeyCredentialRequestOptionsJSON;
        }) => Promise<AuthenticationResponseJSON>;
    };
};
type RequireWallet = () => {
    wallet: SmartAccountClient;
    contractId: string;
};
type SignAuthEntryDeps = WebAuthnDeps & {
    networkPassphrase: string;
    storage: StorageAdapter;
    calculateExpiration: () => Promise<number>;
    getCredentialId: () => string | undefined;
    requireWallet: RequireWallet;
    rpc: rpc.Server;
    timeoutInSeconds: number;
};
export declare function createPasskey(deps: WebAuthnDeps, appName: string, userName: string, authenticatorSelection?: {
    authenticatorAttachment?: "platform" | "cross-platform";
    residentKey?: "discouraged" | "preferred" | "required";
    userVerification?: "discouraged" | "preferred" | "required";
}): Promise<{
    rawResponse: RegistrationResponseJSON;
    credentialId: string;
    publicKey: Uint8Array;
}>;
export declare function authenticatePasskey(deps: WebAuthnDeps): Promise<{
    credentialId: string;
    rawResponse: AuthenticationResponseJSON;
}>;
export declare function signAuthEntry(deps: SignAuthEntryDeps, entry: xdr.SorobanAuthorizationEntry, options?: {
    credentialId?: string;
    expiration?: number;
    contextRuleIds?: number[];
    signer?: ContractSigner;
}): Promise<xdr.SorobanAuthorizationEntry>;
export {};
//# sourceMappingURL=webauthn-ops.d.ts.map