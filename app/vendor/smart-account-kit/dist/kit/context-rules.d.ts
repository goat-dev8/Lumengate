import { rpc, xdr } from "@stellar/stellar-sdk";
import type { ContextRule, ContextRuleType, Signer as ContractSigner } from "smart-account-kit-bindings";
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import type { ContractDetailsResponse } from "../indexer";
type ContextRuleQueryClient = {
    get_context_rule: (args: {
        context_rule_id: number;
    }) => Promise<AssembledTransaction<ContextRule>>;
    get_policy_id?: (args: {
        policy: string;
    }) => Promise<AssembledTransaction<number>>;
    get_signer_id?: (args: {
        signer: ContractSigner;
    }) => Promise<AssembledTransaction<number>>;
};
type ContextRuleReadDeps = {
    rpc?: rpc.Server;
    contractId?: string;
    networkPassphrase?: string;
    timeoutInSeconds?: number;
};
type ContextRuleDiscoveryDeps = {
    getContractDetailsFromIndexer?: () => Promise<ContractDetailsResponse | null>;
    probeRuleIds?: {
        maxRuleId?: number;
        maxConsecutiveMisses?: number;
    };
} & ContextRuleReadDeps;
export declare function contextRuleTypeKey(contextType: ContextRuleType): string;
export declare function contextRuleTypeMatches(ruleType: ContextRuleType, requiredType: ContextRuleType): boolean;
export declare function buildInvocationContextTypes(entry: xdr.SorobanAuthorizationEntry): ContextRuleType[];
export declare function decodeContextRuleResultXdr(resultXdr: string): ContextRule;
export declare function readContextRule(wallet: ContextRuleQueryClient, contextRuleId: number, deps?: ContextRuleReadDeps): Promise<ContextRule>;
export declare function listContextRules(wallet: ContextRuleQueryClient, deps?: ContextRuleDiscoveryDeps): Promise<ContextRule[]>;
export declare function getFilteredContextRules(wallet: ContextRuleQueryClient, contextRuleType: ContextRuleType, deps?: ContextRuleDiscoveryDeps): Promise<ContextRule[]>;
export declare function findWebAuthnSignerInRules(wallet: ContextRuleQueryClient, contextRuleIds: number[], credentialId: Buffer, deps?: ContextRuleReadDeps): Promise<ContractSigner>;
export declare function findWebAuthnSignerForCredential(wallet: ContextRuleQueryClient, credentialId: string, deps?: ContextRuleDiscoveryDeps): Promise<ContractSigner>;
export declare function resolveContextRuleIdsForEntry(wallet: ContextRuleQueryClient, entry: xdr.SorobanAuthorizationEntry, selectedSigners: ContractSigner[], deps?: ContextRuleDiscoveryDeps): Promise<number[]>;
export {};
//# sourceMappingURL=context-rules.d.ts.map