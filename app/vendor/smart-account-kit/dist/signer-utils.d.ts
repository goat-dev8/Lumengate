import type { Signer } from "smart-account-kit-bindings";
export declare function getCredentialIdFromSigner(signer: Signer): string | null;
export declare function signersEqual(a: Signer, b: Signer): boolean;
export declare function getSignerKey(signer: Signer): string;
export declare function collectUniqueSigners(signers: Signer[]): Signer[];
//# sourceMappingURL=signer-utils.d.ts.map