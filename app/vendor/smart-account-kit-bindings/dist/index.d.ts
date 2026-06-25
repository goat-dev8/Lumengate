import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
/**
 * Error codes for smart account operations.
 */
export declare const SmartAccountError: {
    /**
     * The specified context rule does not exist.
     */
    3000: {
        message: string;
    };
    /**
     * The provided context cannot be validated against any rule.
     */
    3002: {
        message: string;
    };
    /**
     * External signature verification failed.
     */
    3003: {
        message: string;
    };
    /**
     * Context rule must have at least one signer or policy.
     */
    3004: {
        message: string;
    };
    /**
     * The valid_until timestamp is in the past.
     */
    3005: {
        message: string;
    };
    /**
     * The specified signer was not found.
     */
    3006: {
        message: string;
    };
    /**
     * The signer already exists in the context rule.
     */
    3007: {
        message: string;
    };
    /**
     * The specified policy was not found.
     */
    3008: {
        message: string;
    };
    /**
     * The policy already exists in the context rule.
     */
    3009: {
        message: string;
    };
    /**
     * Too many signers in the context rule.
     */
    3010: {
        message: string;
    };
    /**
     * Too many policies in the context rule.
     */
    3011: {
        message: string;
    };
    /**
     * An internal ID counter (context rule, signer, or policy) has reached
     * its maximum value (`u32::MAX`) and cannot be incremented further.
     */
    3012: {
        message: string;
    };
    /**
     * External signer key data exceeds the maximum allowed size.
     */
    3013: {
        message: string;
    };
    /**
     * context_rule_ids length does not match auth_contexts length.
     */
    3014: {
        message: string;
    };
    /**
     * Context rule name exceeds the maximum allowed length.
     */
    3015: {
        message: string;
    };
    /**
     * A signer in `AuthPayload` is not part of any selected context rule.
     */
    3016: {
        message: string;
    };
};
/**
 * Represents different types of signers in the smart account system.
 */
export type Signer = {
    tag: "Delegated";
    values: readonly [string];
} | {
    tag: "External";
    values: readonly [string, Buffer];
};
/**
 * The authorization payload passed to `__check_auth`, bundling cryptographic
 * proofs with context rule selection.
 *
 * This struct carries two distinct pieces of information that are both
 * required for authorization but cannot be derived from each other:
 *
 * - `signers` maps each [`Signer`] to its raw signature bytes, providing
 * cryptographic proof that the signer actually signed the transaction
 * payload. A context rule stores which signer *identities* are authorized
 * (via `signer_ids`), but the rule does not contain the signatures
 * themselves — those must be supplied here.
 *
 * - `context_rule_ids` tells the system which rule to validate for each auth
 * context. Because multiple rules can exist for the same context type, the
 * caller must explicitly select one per context rather than relying on
 * auto-discovery. Each entry is aligned by index with the `auth_contexts`
 * passed to `__check_auth`.
 *
 * The length of `context_rule_ids` must equal the number of auth contexts;
 * a mismatch is rejected with
 * [`SmartAccountError::ContextRuleIdsLen
 */
export interface AuthPayload {
    /**
   * Per-context rule IDs, aligned by index with `auth_contexts`.
   */
    context_rule_ids: Array<u32>;
    /**
   * Signature data mapped to each signer.
   */
    signers: Map<Signer, Buffer>;
}
/**
 * A complete context rule defining authorization requirements.
 */
export interface ContextRule {
    /**
   * The type of context this rule applies to.
   */
    context_type: ContextRuleType;
    /**
   * Unique identifier for the context rule.
   */
    id: u32;
    /**
   * Human-readable name for the context rule.
   */
    name: string;
    /**
   * List of policy contracts that must be satisfied.
   */
    policies: Array<string>;
    /**
   * Global registry IDs for each policy, positionally aligned with
   * `policies`.
   */
    policy_ids: Array<u32>;
    /**
   * Global registry IDs for each signer, positionally aligned with
   * `signers`.
   */
    signer_ids: Array<u32>;
    /**
   * List of signers authorized by this rule.
   */
    signers: Array<Signer>;
    /**
   * Optional expiration ledger sequence for the rule.
   */
    valid_until: Option<u32>;
}
/**
 * Types of contexts that can be authorized by smart account rules.
 */
export type ContextRuleType = {
    tag: "Default";
    values: void;
} | {
    tag: "CallContract";
    values: readonly [string];
} | {
    tag: "CreateContract";
    values: readonly [Buffer];
};
export interface Client {
    /**
     * Construct and simulate a execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Executes a function call on a target contract from within the smart
     * account context.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `target` - The address of the contract to call.
     * * `target_fn` - The function name to invoke on the target contract.
     * * `target_args` - Arguments to pass to the target function.
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then calling
     * `e.invoke_contract()`.
     */
    execute: ({ target, target_fn, target_args }: {
        target: string;
        target_fn: string;
        target_args: Array<any>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    upgrade: ({ new_wasm_hash, operator }: {
        new_wasm_hash: Buffer;
        operator: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a add_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Adds a new policy to an existing context rule, installs it, and returns
     * the assigned policy ID. The policy's `install` method will be called
     * during this operation.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The ID of the context rule to modify.
     * * `policy` - The address of the policy contract to add.
     * * `install_param` - The installation parameter for the policy.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     * * [`SmartAccountError::DuplicatePolicy`] - When the policy already
     * exists in the rule.
     * * [`SmartAccountError::TooManyPolicies`] - When adding would exceed
     * MAX_POLICIES (5).
     *
     * # Events
     *
     * * topics - `["policy_added", context_rule_id: u32]`
     * * data - `[policy_id: u32]`
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then delegating to
     * [`storage::add_policy`].
     */
    add_policy: ({ context_rule_id, policy, install_param }: {
        context_rule_id: u32;
        policy: string;
        install_param: any;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a add_signer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Adds a new signer to an existing context rule, returning the assigned
     * signer ID.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The ID of the context rule to modify.
     * * `signer` - The signer to add to the context rule.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     * * [`SmartAccountError::DuplicateSigner`] - When the signer already
     * exists in the rule.
     * * [`SmartAccountError::TooManySigners`] - When adding would exceed
     * MAX_SIGNERS (15).
     *
     * # Events
     *
     * * topics - `["signer_added", context_rule_id: u32]`
     * * data - `[signer_id: u32]`
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then delegating to
     * [`storage::add_signer`].
     */
    add_signer: ({ context_rule_id, signer }: {
        context_rule_id: u32;
        signer: Signer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a get_policy_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Retrieves the global registry ID for a policy.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `policy` - The policy address to look up.
     *
     * # Errors
     *
     * * [`SmartAccountError::PolicyNotFound`] - When the policy is not
     * registered in the global registry.
     */
    get_policy_id: ({ policy }: {
        policy: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a get_signer_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Retrieves the global registry ID for a signer.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `signer` - The signer to look up.
     *
     * # Errors
     *
     * * [`SmartAccountError::SignerNotFound`] - When the signer is not
     * registered in the global registry.
     */
    get_signer_id: ({ signer }: {
        signer: Signer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a remove_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Removes a policy from an existing context rule and uninstalls it. The
     * policy's `uninstall` method will be called during this operation.
     * Removing the last policy is allowed only if the rule has at least
     * one signer.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The ID of the context rule to modify.
     * * `policy_id` - The ID of the policy to remove from the context rule.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     * * [`SmartAccountError::PolicyNotFound`] - When the policy doesn't exist
     * in the rule.
     *
     * # Events
     *
     * * topics - `["policy_removed", context_rule_id: u32]`
     * * data - `[policy_id: u32]`
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then delegating to
     * [`storage::remove_policy`].
     */
    remove_policy: ({ context_rule_id, policy_id }: {
        context_rule_id: u32;
        policy_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a remove_signer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Removes a signer from an existing context rule. Removing the last signer
     * is allowed only if the rule has at least one policy.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The ID of the context rule to modify.
     * * `signer_id` - The ID of the signer to remove from the context rule.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     * * [`SmartAccountError::SignerNotFound`] - When the signer doesn't exist
     * in the rule.
     *
     * # Events
     *
     * * topics - `["signer_removed", context_rule_id: u32]`
     * * data - `[signer_id: u32]`
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then delegating to
     * [`storage::remove_signer`].
     */
    remove_signer: ({ context_rule_id, signer_id }: {
        context_rule_id: u32;
        signer_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a add_context_rule transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Creates a new context rule with the specified configuration, returning
     * the newly created `ContextRule` with a unique ID assigned. Installs
     * all specified policies during creation.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_type` - The type of context this rule applies to.
     * * `name` - Human-readable name for the context rule.
     * * `valid_until` - Optional expiration ledger sequence.
     * * `signers` - List of signers authorized by this rule.
     * * `policies` - Map of policy addresses to their installation parameters.
     *
     * # Errors
     *
     * * [`SmartAccountError::NoSignersAndPolicies`] - When both signers and
     * policies are empty.
     * * [`SmartAccountError::TooManySigners`] - When signers exceed
     * MAX_SIGNERS (15).
     * * [`SmartAccountError::TooManyPolicies`] - When policies exceed
     * MAX_POLICIES (5).
     * * [`SmartAccountError::DuplicateSigner`] - When the same signer appears
     * multiple times.
     * * [`SmartAccountError::PastValidUntil`] - When valid_until is in the
     * past.
     * * [`SmartAccountError::MathOverflow`] - When the context rule, si
     */
    add_context_rule: ({ context_type, name, valid_until, signers, policies }: {
        context_type: ContextRuleType;
        name: string;
        valid_until: Option<u32>;
        signers: Array<Signer>;
        policies: Map<string, any>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<ContextRule>>;
    /**
     * Construct and simulate a batch_add_signer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    batch_add_signer: ({ context_rule_id, signers }: {
        context_rule_id: u32;
        signers: Array<Signer>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_context_rule transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Retrieves a context rule by its unique ID, returning the
     * `ContextRule` containing all metadata, signers, and policies.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The unique identifier of the context rule to
     * retrieve.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     */
    get_context_rule: ({ context_rule_id }: {
        context_rule_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<ContextRule>>;
    /**
     * Construct and simulate a remove_context_rule transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Removes a context rule and cleans up all associated data. This function
     * uninstalls all policies associated with the rule and removes all stored
     * data including signers, policies, and metadata.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The ID of the context rule to remove.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     *
     * # Events
     *
     * * topics - `["context_rule_removed", context_rule_id: u32]`
     * * data - `[]`
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then delegating to
     * [`storage::remove_context_rule`].
     */
    remove_context_rule: ({ context_rule_id }: {
        context_rule_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_context_rules_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Retrieves the number of all context rules, including expired rules.
     * Defaults to 0.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     */
    get_context_rules_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a update_context_rule_name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Updates the name of an existing context rule, returning the updated
     * `ContextRule` with the new name.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The ID of the context rule to update.
     * * `name` - The new human-readable name for the context rule.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     *
     * # Events
     *
     * * topics - `["context_rule_meta_updated", context_rule_id: u32]`
     * * data - `[name: String, context_type: ContextRuleType, valid_until:
     * Option<u32>]`
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then delegating to
     * [`storage::update_context_rule_name`].
     */
    update_context_rule_name: ({ context_rule_id, name }: {
        context_rule_id: u32;
        name: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<ContextRule>>;
    /**
     * Construct and simulate a update_context_rule_valid_until transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Updates the expiration time of an existing context rule, returning the
     * updated `ContextRule` with the new expiration time.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `context_rule_id` - The ID of the context rule to update.
     * * `valid_until` - New optional expiration ledger sequence. Use `None`
     * for no expiration.
     *
     * # Errors
     *
     * * [`SmartAccountError::ContextRuleNotFound`] - When no context rule
     * exists with the given ID.
     * * [`SmartAccountError::PastValidUntil`] - When valid_until is in the
     * past.
     *
     * # Events
     *
     * * topics - `["context_rule_meta_updated", context_rule_id: u32]`
     * * data - `[name: String, context_type: ContextRuleType, valid_until:
     * Option<u32>]`
     *
     * # Notes
     *
     * Defaults to requiring authorization from the smart account itself
     * (`e.current_contract_address().require_auth()`) and then delegating to
     * [`storage::update_context_rule_valid_until`].
     */
    update_context_rule_valid_until: ({ context_rule_id, valid_until }: {
        context_rule_id: u32;
        valid_until: Option<u32>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<ContextRule>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { signers, policies }: {
        signers: Array<Signer>;
        policies: Map<string, any>;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        execute: (json: string) => AssembledTransaction<null>;
        upgrade: (json: string) => AssembledTransaction<null>;
        add_policy: (json: string) => AssembledTransaction<number>;
        add_signer: (json: string) => AssembledTransaction<number>;
        get_policy_id: (json: string) => AssembledTransaction<number>;
        get_signer_id: (json: string) => AssembledTransaction<number>;
        remove_policy: (json: string) => AssembledTransaction<null>;
        remove_signer: (json: string) => AssembledTransaction<null>;
        add_context_rule: (json: string) => AssembledTransaction<ContextRule>;
        batch_add_signer: (json: string) => AssembledTransaction<null>;
        get_context_rule: (json: string) => AssembledTransaction<ContextRule>;
        remove_context_rule: (json: string) => AssembledTransaction<null>;
        get_context_rules_count: (json: string) => AssembledTransaction<number>;
        update_context_rule_name: (json: string) => AssembledTransaction<ContextRule>;
        update_context_rule_valid_until: (json: string) => AssembledTransaction<ContextRule>;
    };
}
