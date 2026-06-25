/**
 * Indexer Client for Smart Account Kit
 *
 * Provides reverse lookups from signers (credential IDs, addresses) to smart account contracts.
 * This enables discovering which contracts a user has access to based on their signer credentials.
 */
import { DEFAULT_INDEXER_TIMEOUT_MS, API_PATH_LOOKUP, API_PATH_LOOKUP_ADDRESS, API_PATH_CONTRACT, API_PATH_STATS, } from "./constants";
/**
 * Default indexer URLs for known networks
 */
export const DEFAULT_INDEXER_URLS = {
    "Test SDF Network ; September 2015": "https://smart-account-indexer.sdf-ecosystem.workers.dev",
    "Public Global Stellar Network ; September 2015": "https://smart-account-indexer-mainnet.sdf-ecosystem.workers.dev",
};
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
export class IndexerClient {
    baseUrl;
    timeout;
    constructor(config) {
        // Remove trailing slash if present
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.timeout = config.timeout ?? DEFAULT_INDEXER_TIMEOUT_MS;
    }
    /**
     * Create an IndexerClient for a specific network passphrase.
     * Uses the default indexer URL for known networks.
     *
     * @param networkPassphrase - The Stellar network passphrase
     * @returns IndexerClient configured for the network, or null if no default URL exists
     */
    static forNetwork(networkPassphrase) {
        const url = DEFAULT_INDEXER_URLS[networkPassphrase];
        if (!url)
            return null;
        return new IndexerClient({ baseUrl: url });
    }
    /**
     * Look up smart account contracts by credential ID.
     *
     * This is the primary lookup method for passkey-based signers.
     * The credential ID comes from WebAuthn authentication.
     *
     * @param credentialId - Hex-encoded credential ID (from passkey)
     * @returns Contracts associated with this credential
     */
    async lookupByCredentialId(credentialId) {
        // Ensure credential ID is lowercase hex
        const normalizedId = credentialId.toLowerCase().replace(/^0x/, "");
        const response = await this.fetch(`${API_PATH_LOOKUP}/${normalizedId}`);
        // Convert string counts to numbers (postgres returns strings for bigint)
        return {
            ...response,
            contracts: response.contracts.map(this.normalizeContractSummary),
        };
    }
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
    async lookupByAddress(address) {
        const response = await this.fetch(`${API_PATH_LOOKUP_ADDRESS}/${address}`);
        return {
            ...response,
            contracts: response.contracts.map(this.normalizeContractSummary),
        };
    }
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
    async getContractDetails(contractId) {
        try {
            const response = await this.fetch(`${API_PATH_CONTRACT}/${contractId}`);
            return {
                ...response,
                summary: this.normalizeContractSummary(response.summary),
            };
        }
        catch (error) {
            // Return null for 404 (contract not found)
            if (error instanceof IndexerError && error.status === 404) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Get indexer statistics.
     *
     * Useful for debugging and monitoring.
     */
    async getStats() {
        return this.fetch(API_PATH_STATS);
    }
    /**
     * Check if the indexer is healthy and reachable.
     */
    async isHealthy() {
        try {
            const response = await this.fetch("/");
            return response.status === "ok";
        }
        catch {
            return false;
        }
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    async fetch(path) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                headers: {
                    Accept: "application/json",
                },
                signal: controller.signal,
            });
            if (!response.ok) {
                const errorBody = await response.text().catch(() => "");
                throw new IndexerError(`Indexer request failed: ${response.status} ${response.statusText}`, response.status, errorBody);
            }
            return (await response.json());
        }
        catch (error) {
            if (error instanceof IndexerError) {
                throw error;
            }
            if (error instanceof Error && error.name === "AbortError") {
                throw new IndexerError("Indexer request timed out", 0);
            }
            throw new IndexerError(`Indexer request failed: ${error instanceof Error ? error.message : String(error)}`, 0);
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Normalize contract summary counts from strings to numbers.
     * PostgreSQL returns bigint as strings in JSON.
     */
    normalizeContractSummary(summary) {
        return {
            ...summary,
            context_rule_count: Number(summary.context_rule_count),
            external_signer_count: Number(summary.external_signer_count),
            delegated_signer_count: Number(summary.delegated_signer_count),
            native_signer_count: Number(summary.native_signer_count),
            first_seen_ledger: Number(summary.first_seen_ledger),
            last_seen_ledger: Number(summary.last_seen_ledger),
        };
    }
}
// ============================================================================
// Errors
// ============================================================================
/**
 * Error thrown by IndexerClient operations
 */
export class IndexerError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "IndexerError";
    }
}
//# sourceMappingURL=indexer.js.map