import { xdr } from "@stellar/stellar-sdk";
import type { Signer as ContractSigner } from "smart-account-kit-bindings";
export declare function makeAccount(seed: number): string;
export declare function makeContract(seed: number): string;
export declare function makeDelegatedSigner(seed: number): ContractSigner;
export declare function makeExternalSigner(verifierSeed: number, publicKeySeed: number, credentialSeed: number): ContractSigner;
export declare function makeAddressAuthEntry(contractId: string): xdr.SorobanAuthorizationEntry;
//# sourceMappingURL=test-utils.d.ts.map