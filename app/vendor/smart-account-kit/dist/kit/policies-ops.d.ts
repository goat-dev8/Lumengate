import { xdr } from "@stellar/stellar-sdk";
import type { Client as SmartAccountClient } from "smart-account-kit-bindings";
export declare function convertPolicyParams(_wallet: SmartAccountClient | undefined, policyType: "threshold" | "spending_limit" | "weighted_threshold", params: unknown): unknown;
export declare function buildPoliciesScVal(wallet: SmartAccountClient | undefined, policies: Map<string, unknown>, policyTypes: Map<string, "threshold" | "spending_limit" | "weighted_threshold" | "custom">): xdr.ScVal;
//# sourceMappingURL=policies-ops.d.ts.map