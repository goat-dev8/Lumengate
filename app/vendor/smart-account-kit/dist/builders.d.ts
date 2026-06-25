/**
 * Builder utilities for Smart Account Kit
 *
 * Type-safe constructors for creating signers, context rule types, and policy parameters.
 * These helpers ensure correct data structures are created for smart account operations.
 *
 * @packageDocumentation
 */
import type { Signer, ContextRuleType } from "smart-account-kit-bindings";
import type { SimpleThresholdAccountParams, WeightedThresholdAccountParams, SpendingLimitAccountParams } from "./contract-types";
/**
 * Create a Delegated signer (native Stellar account).
 *
 * Delegated signers use Stellar's native `require_auth()` mechanism.
 * No external verifier contract is needed.
 *
 * @param publicKey - Stellar account public key (G...)
 * @returns Signer object for use in context rules
 *
 * @example
 * ```typescript
 * const signer = createDelegatedSigner("G...");
 * ```
 */
export declare function createDelegatedSigner(publicKey: string): Signer;
/**
 * Create an External signer (custom verifier contract).
 *
 * External signers use a verifier contract to validate signatures.
 * Used for WebAuthn passkeys, Ed25519 with custom logic, etc.
 *
 * @param verifierAddress - Verifier contract address (C...)
 * @param keyData - Key data for the verifier (format depends on verifier)
 * @returns Signer object for use in context rules
 *
 * @example
 * ```typescript
 * // WebAuthn signer (keyData = 65-byte pubkey + credentialId)
 * const webauthnSigner = createExternalSigner(
 *   "C...", // WebAuthn verifier address
 *   buildKeyData(publicKey, credentialId)
 * );
 *
 * // Ed25519 signer (keyData = 32-byte public key)
 * const ed25519Signer = createExternalSigner(
 *   "C...", // Ed25519 verifier address
 *   ed25519PublicKey
 * );
 * ```
 */
export declare function createExternalSigner(verifierAddress: string, keyData: Buffer | Uint8Array): Signer;
/**
 * Create a WebAuthn passkey signer.
 *
 * Convenience wrapper around createExternalSigner that handles
 * the key_data format for WebAuthn (pubkey + credentialId).
 *
 * @param webauthnVerifierAddress - WebAuthn verifier contract address
 * @param publicKey - 65-byte secp256r1 uncompressed public key
 * @param credentialId - Base64URL credential ID or Buffer
 * @returns Signer object for use in context rules
 *
 * @example
 * ```typescript
 * const signer = createWebAuthnSigner(
 *   "C...",
 *   publicKey,
 *   credentialId
 * );
 * ```
 */
export declare function createWebAuthnSigner(webauthnVerifierAddress: string, publicKey: Uint8Array, credentialId: string | Buffer): Signer;
/**
 * Create an Ed25519 signer (with external verifier).
 *
 * For Ed25519 keys that need custom verification logic via a verifier contract.
 * The key data is the 32-byte Ed25519 public key.
 *
 * @param ed25519VerifierAddress - Ed25519 verifier contract address
 * @param publicKey - 32-byte Ed25519 public key
 * @returns Signer object for use in context rules
 *
 * @example
 * ```typescript
 * const signer = createEd25519Signer(
 *   "C...", // Ed25519 verifier address
 *   Keypair.fromPublicKey("G...").rawPublicKey()
 * );
 * ```
 */
export declare function createEd25519Signer(ed25519VerifierAddress: string, publicKey: Buffer | Uint8Array): Signer;
/**
 * Create a Default context rule type.
 *
 * Default rules apply to any operation that doesn't match
 * a more specific CallContract or CreateContract rule.
 *
 * @returns ContextRuleType for default authorization
 *
 * @example
 * ```typescript
 * const contextType = createDefaultContext();
 * await kit.rules.add(contextType, "Primary Signers", signers, policies);
 * ```
 */
export declare function createDefaultContext(): ContextRuleType;
/**
 * Create a CallContract context rule type.
 *
 * CallContract rules apply only when calling a specific contract.
 * Useful for restricting signers to specific dApps or operations.
 *
 * @param contractAddress - The contract address this rule applies to
 * @returns ContextRuleType for contract-specific authorization
 *
 * @example
 * ```typescript
 * const contextType = createCallContractContext("C...");
 * await kit.rules.add(contextType, "DEX Trading", signers, policies);
 * ```
 */
export declare function createCallContractContext(contractAddress: string): ContextRuleType;
/**
 * Create a CreateContract context rule type.
 *
 * CreateContract rules apply only when deploying contracts
 * with a specific WASM hash.
 *
 * @param wasmHash - The WASM hash (32 bytes or 64-char hex string)
 * @returns ContextRuleType for contract creation authorization
 *
 * @example
 * ```typescript
 * const contextType = createCreateContractContext("abc123...");
 * await kit.rules.add(contextType, "Deploy Factory", signers, policies);
 * ```
 */
export declare function createCreateContractContext(wasmHash: string | Buffer): ContextRuleType;
/**
 * Create Simple Threshold policy parameters.
 *
 * Simple threshold requires M-of-N signers where M = threshold
 * and N = total number of signers on the context rule.
 *
 * @param threshold - Minimum number of signers required
 * @returns Policy parameters for simple threshold
 *
 * @example
 * ```typescript
 * // 2-of-3 multisig
 * const params = createThresholdParams(2);
 * await kit.policies.add(ruleId, thresholdPolicyAddress, params);
 * ```
 */
export declare function createThresholdParams(threshold: number): SimpleThresholdAccountParams;
/**
 * Create Weighted Threshold policy parameters.
 *
 * Weighted threshold assigns different weights to different signers.
 * Authorization succeeds when the sum of weights of authenticated
 * signers meets or exceeds the threshold.
 *
 * @param threshold - Total weight required for authorization
 * @param signerWeights - Map of signers to their weights
 * @returns Policy parameters for weighted threshold
 *
 * @example
 * ```typescript
 * const weights = new Map<Signer, number>();
 * weights.set(adminSigner, 100);
 * weights.set(userSigner, 50);
 * const params = createWeightedThresholdParams(100, weights);
 * ```
 */
export declare function createWeightedThresholdParams(threshold: number, signerWeights: Map<Signer, number>): WeightedThresholdAccountParams;
/**
 * Create Spending Limit policy parameters.
 *
 * Spending limit restricts how much can be transferred within
 * a given time period. Useful for rate limiting or daily limits.
 *
 * @param spendingLimit - Maximum amount allowed in the period (in stroops)
 * @param periodLedgers - Number of ledgers in the period (~5 seconds per ledger)
 * @returns Policy parameters for spending limit
 *
 * @example
 * ```typescript
 * // 100 XLM per day (~17280 ledgers at 5 seconds per ledger)
 * const params = createSpendingLimitParams(1000000000n, 17280);
 * await kit.policies.add(ruleId, spendingLimitPolicyAddress, params);
 * ```
 */
export declare function createSpendingLimitParams(spendingLimit: bigint | number, periodLedgers: number): SpendingLimitAccountParams;
export { LEDGERS_PER_HOUR, LEDGERS_PER_DAY, LEDGERS_PER_WEEK } from "./constants";
export declare function truncateAddress(address: string, chars?: number): string;
export declare function signerMatchesCredential(signer: Signer, credentialId: string): boolean;
export declare function signerMatchesAddress(signer: Signer, address: string): boolean;
export declare function describeSignerType(signer: Signer): string;
export declare function formatSignerForDisplay(signer: Signer): {
    type: string;
    display: string;
};
export declare function formatContextType(contextType: ContextRuleType): string;
//# sourceMappingURL=builders.d.ts.map