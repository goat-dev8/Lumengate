/**
 * Policy Manager
 *
 * Manages policies attached to context rules.
 * Policies provide additional authorization constraints beyond signers.
 */
import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
/** Dependencies required by PolicyManager */
export interface PolicyManagerDeps {
    /** Get the connected wallet client, throws if not connected */
    requireWallet: () => {
        wallet: {
            add_policy: (args: {
                context_rule_id: number;
                policy: string;
                install_param: unknown;
            }) => Promise<AssembledTransaction<number>>;
            get_policy_id: (args: {
                policy: string;
            }) => Promise<AssembledTransaction<number>>;
            remove_policy: (args: {
                context_rule_id: number;
                policy_id: number;
            }) => Promise<AssembledTransaction<null>>;
        };
    };
}
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
export declare class PolicyManager {
    private deps;
    constructor(deps: PolicyManagerDeps);
    /**
     * Add a policy to a context rule.
     *
     * @param contextRuleId - The numeric ID of the context rule to add the policy to
     * @param policyAddress - The contract address of the policy to add
     * @param installParams - Policy-specific installation parameters
     * @returns Assembled transaction that adds the policy when signed and sent
     * @throws Error if not connected to a wallet
     */
    add(contextRuleId: number, policyAddress: string, installParams: unknown): Promise<AssembledTransaction<number>>;
    /**
     * Remove a policy from a context rule.
     *
     * @param contextRuleId - The numeric ID of the context rule to remove the policy from
     * @param policyAddress - The contract address of the policy to remove
     * @returns Assembled transaction that removes the policy when signed and sent
     * @throws Error if not connected to a wallet
     */
    remove(contextRuleId: number, policyAddress: string): Promise<AssembledTransaction<null>>;
}
//# sourceMappingURL=policy-manager.d.ts.map