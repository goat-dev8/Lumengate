/**
 * Context Rule Manager
 *
 * Manages context rules (authorization policies) for smart accounts.
 * Context rules define which signers and policies apply to specific
 * operation types (default, contract calls, contract creation).
 */
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import type { rpc } from "@stellar/stellar-sdk";
import type { Signer as ContractSigner, ContextRuleType, ContextRule } from "smart-account-kit-bindings";
import type { ContractDetailsResponse } from "../indexer";
/** Dependencies required by ContextRuleManager */
export interface ContextRuleManagerDeps {
    /** Get the connected wallet client, throws if not connected */
    requireWallet: () => {
        wallet: {
            add_context_rule: (args: {
                context_type: ContextRuleType;
                name: string;
                valid_until: number | undefined;
                signers: ContractSigner[];
                policies: Map<string, unknown>;
            }) => Promise<AssembledTransaction<ContextRule>>;
            get_context_rule: (args: {
                context_rule_id: number;
            }) => Promise<AssembledTransaction<ContextRule>>;
            remove_context_rule: (args: {
                context_rule_id: number;
            }) => Promise<AssembledTransaction<null>>;
            update_context_rule_name: (args: {
                context_rule_id: number;
                name: string;
            }) => Promise<AssembledTransaction<ContextRule>>;
            update_context_rule_valid_until: (args: {
                context_rule_id: number;
                valid_until: number | undefined;
            }) => Promise<AssembledTransaction<ContextRule>>;
        };
        contractId: string;
    };
    rpc: rpc.Server;
    networkPassphrase: string;
    timeoutInSeconds: number;
    getContractDetailsFromIndexer?: () => Promise<ContractDetailsResponse | null>;
    probeRuleIds?: {
        maxRuleId?: number;
        maxConsecutiveMisses?: number;
    };
}
/**
 * Manages context rules for smart accounts.
 *
 * Context rules are the core authorization mechanism for smart accounts.
 * Each rule specifies:
 * - A context type (when the rule applies)
 * - A set of signers (who can authorize)
 * - A set of policies (additional constraints)
 * - An optional expiration
 *
 * @example
 * ```typescript
 * // Add a new context rule
 * const tx = await kit.rules.add(
 *   { tag: "Default", values: undefined },
 *   "My Rule",
 *   [passkeySigner, delegatedSigner],
 *   new Map([[policyAddress, thresholdParams]])
 * );
 * await tx.signAndSend();
 * ```
 */
export declare class ContextRuleManager {
    private deps;
    constructor(deps: ContextRuleManagerDeps);
    /**
     * Add a new context rule to the smart account.
     *
     * @param contextType - When this rule applies (Default, CallContract, CreateContract)
     * @param name - Human-readable name for the rule
     * @param signers - Array of signers that can authorize under this rule
     * @param policies - Map of policy addresses to their parameters
     * @param validUntil - Optional ledger number when this rule expires
     * @returns Assembled transaction that creates the rule when signed and sent
     * @throws Error if not connected to a wallet
     */
    add(contextType: ContextRuleType, name: string, signers: ContractSigner[], policies: Map<string, unknown>, validUntil?: number): Promise<AssembledTransaction<ContextRule>>;
    /**
     * Get a context rule by its ID.
     *
     * @param contextRuleId - The numeric ID of the rule to retrieve
     * @returns Object containing the resolved rule
     * @throws Error if not connected to a wallet
     */
    get(contextRuleId: number): Promise<{
        result: ContextRule;
    }>;
    /**
     * List all active context rules by enumerating them from the contract.
     */
    list(): Promise<ContextRule[]>;
    /**
     * Get all context rules of a specific type.
     *
     * @param contextRuleType - The type of rules to retrieve (Default, CallContract, CreateContract)
     * @returns Assembled transaction that returns an array of matching rules
     * @throws Error if not connected to a wallet
     */
    getAll(contextRuleType: ContextRuleType): Promise<ContextRule[]>;
    /**
     * Remove a context rule from the smart account.
     *
     * @param contextRuleId - The numeric ID of the rule to remove
     * @returns Assembled transaction that removes the rule when signed and sent
     * @throws Error if not connected to a wallet
     */
    remove(contextRuleId: number): Promise<AssembledTransaction<null>>;
    /**
     * Update the name of a context rule.
     *
     * @param contextRuleId - The numeric ID of the rule to update
     * @param name - The new name for the rule
     * @returns Assembled transaction that updates the rule when signed and sent
     * @throws Error if not connected to a wallet
     */
    updateName(contextRuleId: number, name: string): Promise<AssembledTransaction<ContextRule>>;
    /**
     * Update the expiration of a context rule.
     *
     * @param contextRuleId - The numeric ID of the rule to update
     * @param validUntil - The new expiration ledger number (undefined for no expiration)
     * @returns Assembled transaction that updates the rule when signed and sent
     * @throws Error if not connected to a wallet
     */
    updateExpiration(contextRuleId: number, validUntil?: number): Promise<AssembledTransaction<ContextRule>>;
}
//# sourceMappingURL=context-rule-manager.d.ts.map