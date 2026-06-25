/**
 * Indexer Client for Smart Account Kit
 *
 * Provides reverse lookups from signers (credential IDs, addresses) to smart account contracts.
 * This enables discovering which contracts a user has access to based on their signer credentials.
 */
/**
 * Summary of a smart account contract from the indexer
 */
export interface IndexedContractSummary {
    /** Smart account contract address (C-address) */
    contract_id: string;
    /** Number of context rules on the contract */
    context_rule_count: number;
    /** Number of External signers (WebAuthn, custom verifiers) */
    external_signer_count: number;
    /** Number of Delegated signers (G-addresses) */
    delegated_signer_count: number;
    /** Number of Native signers */
    native_signer_count: number;
    /** First ledger where events were seen */
    first_seen_ledger: number;
    /** Most recent ledger where events were seen */
    last_seen_ledger: number;
    /** Array of context rule IDs on this contract */
    context_rule_ids: number[];
}
/**
 * A signer as stored in the indexer
 */
export interface IndexedSigner {
    /** Signer type: 'External', 'Delegated', or 'Native' */
    signer_type: "External" | "Delegated" | "Native";
    /** Verifier contract address (for External) or G-address (for Delegated) */
    signer_address: string | null;
    /** Credential ID for External signers (hex-encoded), null for Delegated */
    credential_id: string | null;
}
/**
 * A policy as stored in the indexer
 */
export interface IndexedPolicy {
    /** Policy contract address */
    policy_address: string;
    /** Installation parameters (JSON) */
    install_params: unknown | null;
}
/**
 * A context rule with its signers and policies
 */
export interface IndexedContextRule {
    /** Context rule ID */
    context_rule_id: number;
    /** Signers in this rule */
    signers: IndexedSigner[];
    /** Policies in this rule */
    policies: IndexedPolicy[];
}
/**
 * Response from credential ID lookup
 */
export interface CredentialLookupResponse {
    /** The credential ID that was looked up */
    credentialId: string;
    /** Contracts associated with this credential */
    contracts: IndexedContractSummary[];
    /** Number of contracts found */
    count: number;
}
/**
 * Response from address lookup
 */
export interface AddressLookupResponse {
    /** The address that was looked up */
    signerAddress: string;
    /** Contracts associated with this address */
    contracts: IndexedContractSummary[];
    /** Number of contracts found */
    count: number;
}
/**
 * Response from contract details endpoint
 */
export interface ContractDetailsResponse {
    /** The contract ID */
    contractId: string;
    /** Summary statistics */
    summary: IndexedContractSummary;
    /** Active context rules with signers and policies */
    contextRules: IndexedContextRule[];
}
/**
 * Response from stats endpoint
 */
export interface IndexerStatsResponse {
    stats: {
        total_events: number;
        unique_contracts: number;
        unique_credentials: number;
        first_ledger: number;
        last_ledger: number;
        eventTypes: Array<{
            event_type: string;
            count: number;
        }>;
    };
}
/**
 * Configuration for the IndexerClient
 */
export interface IndexerConfig {
    /** Base URL of the indexer API */
    baseUrl: string;
    /** Request timeout in milliseconds (default: 10000) */
    timeout?: number;
}
/**
 * Default indexer URLs for known networks
 */
export declare const DEFAULT_INDEXER_URLS: Record<string, string>;
/**
 * Client for querying the smart account indexer.
 *
 * The indexer enables reverse lookups from signer credentials to smart account contracts,
 * which is essential for discovering which contracts a user has access to.
 *
 * @example
 * ```typescript
 * const indexer = new IndexerClient({
 *   baseUrl: 'https://smart-account-indexer.sdf-ecosystem.workers.dev'
 * });
 *
 * // Find contracts by credential ID (from passkey)
 * const result = await indexer.lookupByCredentialId(credentialId);
 *
 * // Find contracts by G-address (for delegated signers)
 * const result = await indexer.lookupByAddress('GABCD...');
 *
 * // Get full contract details
 * const details = await indexer.getContractDetails('CABC...');
 * ```
 */
export declare class IndexerClient {
    private readonly baseUrl;
    private readonly timeout;
    constructor(config: IndexerConfig);
    /**
     * Create an IndexerClient for a specific network passphrase.
     * Uses the default indexer URL for known networks.
     *
     * @param networkPassphrase - The Stellar network passphrase
     * @returns IndexerClient configured for the network, or null if no default URL exists
     */
    static forNetwork(networkPassphrase: string): IndexerClient | null;
    /**
     * Look up smart account contracts by credential ID.
     *
     * This is the primary lookup method for passkey-based signers.
     * The credential ID comes from WebAuthn authentication.
     *
     * @param credentialId - Hex-encoded credential ID (from passkey)
     * @returns Contracts associated with this credential
     */
    lookupByCredentialId(credentialId: string): Promise<CredentialLookupResponse>;
    /**
     * Look up smart account contracts by signer address.
     *
     * This works for both:
     * - G-addresses (Delegated signers)
     * - C-addresses (External signer verifier contracts)
     *
     * @param address - Stellar address (G... or C...)
     * @returns Contracts associated with this address
     */
    lookupByAddress(address: string): Promise<AddressLookupResponse>;
    /**
     * Get detailed information about a smart account contract.
     *
     * Returns the current state including:
     * - Contract summary statistics
     * - Active context rules (excluding removed ones)
     * - Signers for each rule
     * - Policies for each rule
     *
     * @param contractId - Smart account contract address (C...)
     * @returns Contract details or null if not found
     */
    getContractDetails(contractId: string): Promise<ContractDetailsResponse | null>;
    /**
     * Get indexer statistics.
     *
     * Useful for debugging and monitoring.
     */
    getStats(): Promise<IndexerStatsResponse>;
    /**
     * Check if the indexer is healthy and reachable.
     */
    isHealthy(): Promise<boolean>;
    private fetch;
    /**
     * Normalize contract summary counts from strings to numbers.
     * PostgreSQL returns bigint as strings in JSON.
     */
    private normalizeContractSummary;
}
/**
 * Error thrown by IndexerClient operations
 */
export declare class IndexerError extends Error {
    readonly status: number;
    readonly body?: string | undefined;
    constructor(message: string, status: number, body?: string | undefined);
}
//# sourceMappingURL=indexer.d.ts.map