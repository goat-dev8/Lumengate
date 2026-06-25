import { xdr } from "@stellar/stellar-sdk";
import type { AuthPayload, Signer as ContractSigner } from "smart-account-kit-bindings";
import type { WebAuthnSigData } from "../contract-types";
export declare function buildSignaturePayload(networkPassphrase: string, entry: xdr.SorobanAuthorizationEntry, expiration: number): Buffer;
export declare function buildAuthDigest(signaturePayload: Buffer, contextRuleIds: number[]): Buffer;
export declare function buildWebAuthnSignatureBytes(sigData: WebAuthnSigData): Buffer;
export declare function buildAddressSignatureScVal(publicKeyBytes: Uint8Array | Buffer, signatureBytes: Uint8Array | Buffer): xdr.ScVal;
export declare function emptyAuthPayload(): AuthPayload;
export declare function readAuthPayload(signature: xdr.ScVal): AuthPayload;
export declare function writeAuthPayload(payload: AuthPayload): xdr.ScVal;
export declare function upsertAuthPayloadSigner(payload: AuthPayload, signer: ContractSigner, signatureBytes: Buffer): void;
//# sourceMappingURL=auth-payload.d.ts.map