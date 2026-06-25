/**
 * Utility functions for the Smart Account Kit SDK.
 *
 * Contains cryptographic helpers, validation functions, and common operations.
 *
 * @packageDocumentation
 */
import type { RegistrationResponseJSON } from "@simplewebauthn/browser";
/**
 * Validate that a string is a valid Stellar address (G... or C...).
 *
 * Uses stellar-sdk's StrKey methods for proper checksum validation.
 *
 * @param address - The address to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If the address is invalid
 */
export declare function validateAddress(address: string, fieldName?: string): void;
/**
 * Validate that an amount is a positive number.
 *
 * @param amount - The amount to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If the amount is invalid
 */
export declare function validateAmount(amount: number, fieldName?: string): void;
/**
 * Validate that a string is not empty.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ValidationError} If the value is empty
 */
export declare function validateNotEmpty(value: string | undefined | null, fieldName: string): void;
/**
 * Convert XLM amount to stroops.
 *
 * @param xlm - Amount in XLM
 * @returns Amount in stroops as BigInt
 */
export declare function xlmToStroops(xlm: number): bigint;
/**
 * Convert stroops to XLM amount.
 *
 * @param stroops - Amount in stroops
 * @returns Amount in XLM
 */
export declare function stroopsToXlm(stroops: bigint | number): number;
/**
 * Build key_data by concatenating public key and credential ID.
 *
 * The key_data format is: pubkey (65 bytes) + credentialId (variable bytes)
 *
 * @param publicKey - The 65-byte uncompressed secp256r1 public key
 * @param credentialId - The credential ID (as base64url string or Buffer)
 * @returns Concatenated key_data as Buffer
 */
export declare function buildKeyData(publicKey: Uint8Array, credentialId: string | Buffer): Buffer;
/**
 * Extract the public key from key_data.
 *
 * @param keyData - The full key_data (pubkey + credentialId)
 * @returns The 65-byte public key
 */
export declare function extractPubkeyFromKeyData(keyData: Buffer): Buffer;
/**
 * Extract the credential ID from key_data.
 *
 * @param keyData - The full key_data (pubkey + credentialId)
 * @returns The credential ID portion
 */
export declare function extractCredentialIdFromKeyData(keyData: Buffer): Buffer;
/**
 * Derive a contract address from a credential ID.
 *
 * Uses the Stellar contract ID preimage to deterministically derive
 * the contract address from the deployer and credential ID.
 *
 * @param credentialId - The credential ID buffer
 * @param deployerPublicKey - The deployer's public key string
 * @param networkPassphrase - The network passphrase
 * @returns The derived contract address (C...)
 */
export declare function deriveContractAddress(credentialId: Buffer, deployerPublicKey: string, networkPassphrase: string): string;
/**
 * Extract the public key from a WebAuthn attestation response.
 *
 * Tries multiple methods to extract the public key:
 * 1. From response.publicKey directly (if provided)
 * 2. From authenticatorData (parsing CBOR structure)
 * 3. From attestationObject (parsing CBOR structure)
 *
 * @param response - The WebAuthn registration response
 * @returns The 65-byte uncompressed secp256r1 public key
 * @throws {Error} If public key cannot be extracted
 */
export declare function extractPublicKeyFromAttestation(response: RegistrationResponseJSON["response"]): Promise<Uint8Array>;
/**
 * Convert a DER-encoded ECDSA signature to compact format with low-S.
 *
 * Stellar requires signatures in compact (r || s) format with low-S values.
 * This function:
 * 1. Decodes the DER structure
 * 2. Ensures S is in low-S form (S <= n/2)
 * 3. Returns 64-byte compact signature
 *
 * @param derSignature - The DER-encoded signature
 * @returns 64-byte compact signature (r || s)
 */
export declare function compactSignature(derSignature: Buffer): Uint8Array;
/**
 * Generate a random challenge for WebAuthn operations.
 *
 * @returns A base64url-encoded random challenge
 */
export declare function generateChallenge(): string;
//# sourceMappingURL=utils.d.ts.map