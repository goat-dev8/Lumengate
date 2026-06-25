/**
 * Context Rule Manager
 *
 * Manages context rules (authorization policies) for smart accounts.
 * Context rules define which signers and policies apply to specific
 * operation types (default, contract calls, contract creation).
 */
import { getFilteredContextRules, listContextRules, readContextRule } from "../kit/context-rules";
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
export class ContextRuleManager {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
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
    async add(contextType, name, signers, policies, validUntil) {
        return this.deps.requireWallet().wallet.add_context_rule({
            context_type: contextType,
            name,
            valid_until: validUntil,
            signers,
            policies,
        });
    }
    /**
     * Get a context rule by its ID.
     *
     * @param contextRuleId - The numeric ID of the rule to retrieve
     * @returns Object containing the resolved rule
     * @throws Error if not connected to a wallet
     */
    async get(contextRuleId) {
        const { wallet, contractId } = this.deps.requireWallet();
        return {
            result: await readContextRule(wallet, contextRuleId, {
                rpc: this.deps.rpc,
                contractId,
                networkPassphrase: this.deps.networkPassphrase,
                timeoutInSeconds: this.deps.timeoutInSeconds,
            }),
        };
    }
    /**
     * List all active context rules by enumerating them from the contract.
     */
    async list() {
        const { wallet, contractId } = this.deps.requireWallet();
        return listContextRules(wallet, {
            getContractDetailsFromIndexer: this.deps.getContractDetailsFromIndexer,
            probeRuleIds: this.deps.probeRuleIds,
            rpc: this.deps.rpc,
            contractId,
            networkPassphrase: this.deps.networkPassphrase,
            timeoutInSeconds: this.deps.timeoutInSeconds,
        });
    }
    /**
     * Get all context rules of a specific type.
     *
     * @param contextRuleType - The type of rules to retrieve (Default, CallContract, CreateContract)
     * @returns Assembled transaction that returns an array of matching rules
     * @throws Error if not connected to a wallet
     */
    async getAll(contextRuleType) {
        const { wallet, contractId } = this.deps.requireWallet();
        return getFilteredContextRules(wallet, contextRuleType, {
            getContractDetailsFromIndexer: this.deps.getContractDetailsFromIndexer,
            probeRuleIds: this.deps.probeRuleIds,
            rpc: this.deps.rpc,
            contractId,
            networkPassphrase: this.deps.networkPassphrase,
            timeoutInSeconds: this.deps.timeoutInSeconds,
        });
    }
    /**
     * Remove a context rule from the smart account.
     *
     * @param contextRuleId - The numeric ID of the rule to remove
     * @returns Assembled transaction that removes the rule when signed and sent
     * @throws Error if not connected to a wallet
     */
    async remove(contextRuleId) {
        return this.deps.requireWallet().wallet.remove_context_rule({
            context_rule_id: contextRuleId,
        });
    }
    /**
     * Update the name of a context rule.
     *
     * @param contextRuleId - The numeric ID of the rule to update
     * @param name - The new name for the rule
     * @returns Assembled transaction that updates the rule when signed and sent
     * @throws Error if not connected to a wallet
     */
    async updateName(contextRuleId, name) {
        return this.deps.requireWallet().wallet.update_context_rule_name({
            context_rule_id: contextRuleId,
            name,
        });
    }
    /**
     * Update the expiration of a context rule.
     *
     * @param contextRuleId - The numeric ID of the rule to update
     * @param validUntil - The new expiration ledger number (undefined for no expiration)
     * @returns Assembled transaction that updates the rule when signed and sent
     * @throws Error if not connected to a wallet
     */
    async updateExpiration(contextRuleId, validUntil) {
        return this.deps.requireWallet().wallet.update_context_rule_valid_until({
            context_rule_id: contextRuleId,
            valid_until: validUntil,
        });
    }
}
//# sourceMappingURL=context-rule-manager.js.map