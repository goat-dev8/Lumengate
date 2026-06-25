/**
 * Policy Manager
 *
 * Manages policies attached to context rules.
 * Policies provide additional authorization constraints beyond signers.
 */
/**
 * Manages policies for smart account context rules.
 *
 * Policies are contracts that enforce additional authorization constraints.
 * Common policy types include:
 * - Threshold policies (require N-of-M signers)
 * - Weighted threshold policies (signers have different weights)
 * - Spending limit policies (restrict transaction amounts)
 *
 * @example
 * ```typescript
 * import { createThresholdParams } from "smart-account-kit";
 *
 * // Add a 2-of-3 threshold policy
 * const params = createThresholdParams(2);
 * const tx = await kit.policies.add(
 *   contextRuleId,
 *   thresholdPolicyAddress,
 *   params
 * );
 * await tx.signAndSend();
 * ```
 */
export class PolicyManager {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /**
     * Add a policy to a context rule.
     *
     * @param contextRuleId - The numeric ID of the context rule to add the policy to
     * @param policyAddress - The contract address of the policy to add
     * @param installParams - Policy-specific installation parameters
     * @returns Assembled transaction that adds the policy when signed and sent
     * @throws Error if not connected to a wallet
     */
    async add(contextRuleId, policyAddress, installParams) {
        return this.deps.requireWallet().wallet.add_policy({
            context_rule_id: contextRuleId,
            policy: policyAddress,
            install_param: installParams,
        });
    }
    /**
     * Remove a policy from a context rule.
     *
     * @param contextRuleId - The numeric ID of the context rule to remove the policy from
     * @param policyAddress - The contract address of the policy to remove
     * @returns Assembled transaction that removes the policy when signed and sent
     * @throws Error if not connected to a wallet
     */
    async remove(contextRuleId, policyAddress) {
        const { wallet } = this.deps.requireWallet();
        const policyId = (await wallet.get_policy_id({
            policy: policyAddress,
        })).result;
        if (policyId === undefined || policyId === null) {
            throw new Error(`Policy ${policyAddress} not found on context rule ${contextRuleId}`);
        }
        return wallet.remove_policy({
            context_rule_id: contextRuleId,
            policy_id: policyId,
        });
    }
}
//# sourceMappingURL=policy-manager.js.map